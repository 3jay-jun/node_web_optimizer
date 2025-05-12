import fs from "fs";
import path from "path";
import UglifyJS from 'uglify-js';
import Sharp from 'sharp';
import postcss from 'postcss';
import cssnano from 'cssnano';
import _ from 'lodash';
import postcssScss from 'postcss-scss';
import Log from './util/logger.js';
import Logger from "./util/logger.js";

export const CONVERTED_CSS = []; ; // CONVERT_CSS 변수 내보내기

export function process(options) {
    const OUTPUT_OPTION = _.merge({
        /**
         * IS_TEST
         * true = 대상 경로(PROJECT_PATH)의 폴더 구조와 동일한 경로로 PATH 경로에 복사
         * false = 경량화 작업본 확인 용도
         * */
        IS_TEST: false,
        /** 작업 중 로그 출력 여부 */
        IS_LOG: true,

        /** 최적화 작업 경로  */
        PROJECT_PATH : '',

        /** 최적화 확장자  */
        OPTIMIZATION_EXTENSIONS : {},
        /** 최적화 예외 처리 */
        OPTIMIZATION_EXCLUDE: {},

        /** 이미지 퀄리티 설정 */
        IMAGE_QUALITY: 80,
        IMAGE_EXTENSIONS: '.webp',

        /**  하단 옵션은 IS_TEST === false 일때 */
        PATH: './.output/',      // 결과물 출력 경로
        PREPEND: '',      // 파일 앞에 붙이고 싶은 TEXT

        /** System Options*/
        BATCH_SIZE: 100, // 배치 크기 설정
    }, options);

    const logger = new Logger(OUTPUT_OPTION.IS_LOG);

    const CONVERT_IMAGE = []

    /**
     * 확장자 기반으로 최적화 파일 찾기
     * */
    async function findFilesByExtensions() {
        const extenstionFiles = _.merge({"markup": [".html", ".jsp"]}, OUTPUT_OPTION.OPTIMIZATION_EXTENSIONS);

        const foundFiles = {}
        Object.keys(extenstionFiles).forEach((key) => foundFiles[key] = [])
        foundFiles.other = [];
        async function recurse(currentPath) {
            const files = fs.readdirSync(currentPath);
            for (const file of files) {
                const filePath = path.join(currentPath, file);
                const stats = fs.statSync(filePath);
                if (stats.isDirectory()) {
                    await recurse(filePath);
                } else {
                    const ext = path.extname(file).toLowerCase();
                    Object.keys(extenstionFiles).forEach((key) => {
                        if (extenstionFiles[key].includes(ext)) {
                            if (!foundFiles[key]) foundFiles[key] = [];
                            foundFiles[key].push(filePath);
                        } else {
                            foundFiles["other"].push(filePath);
                        }
                    });
                }
            }
        }

        await recurse(OUTPUT_OPTION.PROJECT_PATH);
        return foundFiles;
    }


    /**
     * javascript 경량화
     * */
    async function jsMinify(file, indicateFunc) {
        try {
            if (!OUTPUT_OPTION.OPTIMIZATION_EXTENSIONS["script"].some((e) => e === path.extname(file).toLowerCase())) return;
            if (OUTPUT_OPTION.OPTIMIZATION_EXCLUDE["script"].some((e) => file.includes(e))) return;

            const code = fs.readFileSync(file, 'utf8');
            const result = await UglifyJS.minify(code, {compress: {drop_console: true}, mangle: true});
            if (result.error) {
                console.error(result.error);
                return;
            }

            const outputPath = generateOutputPath(file, 'js');
            await fs.writeFileSync(outputPath, result.code);
            logger.info(`${file} -> ${outputPath} 변환 완료`);
        } catch (e) {
            console.error(e);
        }
    }


    /**
     * 이미지 경량화
     * */
    async function imgMinify(file) {
        try {
            if (!OUTPUT_OPTION.OPTIMIZATION_EXTENSIONS["image"].some((e) => e === path.extname(file).toLowerCase())) return;
            if (OUTPUT_OPTION.OPTIMIZATION_EXCLUDE["image"].some((e) => file.includes(e))) return;

            const ext = path.extname(file).toLowerCase();
            const outputFilePath = generateOutputPath(file.replace(ext, OUTPUT_OPTION.IMAGE_EXTENSIONS), 'img');
            await Sharp(file).webp({quality: OUTPUT_OPTION.IMAGE_QUALITY}).toFile(outputFilePath);
            CONVERT_IMAGE.push(outputFilePath);
            logger.info(`${file} -> ${outputFilePath} 변환 완료`);
        } catch (error) {
            logger.error(`${file} 변환 실패: ${error.message}`);
        }
    }


    /**
     * CSS 경량화
     * */
    async function cssMinify(file) {
        try {
            if (!OUTPUT_OPTION.OPTIMIZATION_EXTENSIONS["css"].some((e) => e === path.extname(file).toLowerCase())) return;
            if (OUTPUT_OPTION.OPTIMIZATION_EXCLUDE["css"].some((e) => file.includes(e))) return;

            const css = fs.readFileSync(file, 'utf8');
            const outputFilePath = generateOutputPath(file, 'css');
            const result = await postcss([cssnano({preset: 'default'})]).process(css, {
                from: file,
                to: outputFilePath,
                parser: postcssScss
            });
            CONVERTED_CSS.push(outputFilePath);
            await fs.writeFileSync(outputFilePath, result.css);
            logger.info(`CSS 파일 처리 완료: ${outputFilePath}`);
        } catch (error) {
            logger.error(`CSS 파일 처리 완료: ${error.message}`);
        }
    }


    /**
     * 전체 파일 복사
     * */
    async function otherFile(file) {
        if (OUTPUT_OPTION.IS_TEST) return;
        try {
            const other = fs.readFileSync(file, 'utf8');
            const outputPath = generateOutputPath(file);
            await fs.writeFileSync(outputPath, other);
            logger.info(`File Copy 완료 : ${outputPath}`);
        } catch (e) {
            logger.error(e);
        }
    }


    /**
     * 파일 내용 중 이미지 파일 경로의 확장자를 변환하는 함수.
     *
     * 작동 방식:
     * 1. 파일을 읽어와(content), 파일 확장자에 따라 정규식(regex)을 선택한다.
     *    - .css/.scss 파일이면 CSS용 정규식(cssRegex) 사용
     *    - 그 외(.html, .jsp 등)는 일반 img 태그용 정규식(regex) 사용
     * 2. 파일 내용 중 이미지 링크를 찾아 다음을 수행한다:
     *    - http 또는 https로 시작하는 외부 링크는 건드리지 않음.
     *    - 변환 대상(CONVERT_IMAGE 배열)에 포함된 파일명만 확장자를 OUTPUT_OPTION.IMAGE_EXTENSIONS 값으로 변경.
     * 3. 변경된 내용을 출력 디렉토리(outputPath)에 저장한다.
     * 4. 성공 또는 실패 시 로그를 출력한다.
     */
    async function replaceExtensions(file) {
        if (OUTPUT_OPTION.IS_TEST) return;
        try {
            let content = fs.readFileSync(file, 'utf8');
            const regex = /<img[^>]?src=['"]([^'"]*(\.[a-zA-Z0-9]+))['"].*?>/g;
            const cssRegex = /url\(['"]?([^'"]*(\.[a-zA-Z0-9]+))['"]?\)/g;
            const ext = path.extname(file).toLowerCase();
            const fileRegx = [".css", ".scss"].some((e) => e === ext) ? cssRegex : regex;

            if (!fileRegx.test(content)) return;
            content = await content.replace(fileRegx, (match, p1, p2) => {
                if (/https?/g.test(match)) return match;
                if (!CONVERT_IMAGE.some((e) => p1.includes(path.basename(e, path.extname(e))))) return match;
                return match.replace(p2, OUTPUT_OPTION.IMAGE_EXTENSIONS);
            });

            const outputPath = generateOutputPath(file);
            fs.writeFileSync(outputPath, content, "utf-8");
            logger.info(`${outputPath} 파일의 이미지 확장자 치환 완료`);
        } catch (err) {
            logger.error(`파일 처리 실패: ${err.message}`);
        }
    }


    /**
     * 주어진 파일 경로(filePath)를 기반으로 출력용 파일 경로를 생성하는 함수.
     *
     * 작동 방식:
     * - OUTPUT_OPTION.IS_TEST 값에 따라 동작이 달라진다:
     *   1. 테스트 모드(OUTPUT_OPTION.IS_TEST= false)인 경우:
     *      - 대상 경로(PROJECT_PATH)를 OUTPUT_OPTION.PATH로 교체하여 출력
     *   2. 테스트 모드가 아닌 경우(true):
     *      - 원본 파일명만 가져온 뒤(경로 제외) OUTPUT_OPTION.PATH, prefixDir, OUTPUT_OPTION.PREPEND를 조합하여 새로운 경로를 만든다.
     *      - 경량화 작업본만 확인 용도
     */
    function generateOutputPath(filePath, prefixDir = '') {
        if (!OUTPUT_OPTION.IS_TEST) {
            filePath = filePath.replace(OUTPUT_OPTION.PROJECT_PATH, OUTPUT_OPTION.PATH)
        } else {
            const fileName = filePath.split("\\")[filePath.split("\\").length - 1];
            filePath = OUTPUT_OPTION.PATH + prefixDir + '/' + OUTPUT_OPTION.PREPEND + fileName
        }

        const directory = path.dirname(filePath); // 폴더 경로 추출

        // 폴더가 존재하지 않으면 생성
        if (!fs.existsSync(directory)) {
            fs.mkdirSync(directory, { recursive: true }); // recursive: 하위 폴더까지 생성
        }

        return filePath;
    }


    /**
     * 주어진 파일 리스트를 일정한 배치 크기(BATCH_SIZE)로 나누어 비동기 처리하는 함수.
     *
     * 작동 방식:
     * - files 배열을 BATCH_SIZE 단위로 나눈다.
     * - 각 배치(batch)에 대해 병렬로 실행한다.
     * - 각 파일 처리 후, indicateFunc.update()를 호출하여 진행 상태를 갱신한다.
     * - 모든 파일 처리가 끝날 때까지 배치별로 await를 사용해 순차적으로 진행한다.
     */
    async function processBatch(files, processFunction, indicateFunc) {
        for (let i = 0; i < files.length; i += OUTPUT_OPTION.BATCH_SIZE) {
            const batch = files.slice(i, i + OUTPUT_OPTION.BATCH_SIZE);
            await Promise.allSettled(batch.map(file => {
                processFunction(file);
                indicateFunc.update()
            }));
        }
    }

    return {
        findFilesByExtensions,
        jsMinify,
        imgMinify,
        cssMinify,
        otherFile,
        replaceExtensions,

        processBatch
    }
}