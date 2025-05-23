import { promises as fs } from 'fs';
import { existsSync, mkdirSync } from 'fs';
import path from "path";
import UglifyJS from 'uglify-js';
import Sharp from 'sharp';
import postcss from 'postcss';
import postcssNested from 'postcss-nested';
import postcssSimpleVars  from 'postcss-simple-vars';

import cssnano from 'cssnano';
import _ from 'lodash';
import postcssScss from 'postcss-scss';
import Logger from "./util/logger.js";

export const CONVERTED_CSS = []; ; // CONVERT_CSS 변수 내보내기

export function process(options) {
    const OUTPUT_OPTION = _.merge({
        /**
         * IS_TEST
         * true = 경량화 작업본 확인 용도
         * false = 대상 경로(PROJECT_PATH)의 폴더 구조와 동일한 경로로 PATH 경로에 복사
         * */
        IS_TEST: true,
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

        /** Css Merge */
        CSS_MERGE_NAME: 'merged.min',
        IS_REPLACE_CSS_MERGE: true
    }, options);

    const logger = new Logger(OUTPUT_OPTION.IS_LOG);

    const CONVERT_IMAGE = []

    /**
     * 확장자 기반으로 최적화 파일 찾기
     * */
    async function findFilesByExtensions() {
        // 확장자 목록 병합 (기본값과 사용자 정의 옵션)
        const extensionFiles = _.merge({"markup": [".html", ".jsp"]}, OUTPUT_OPTION.OPTIMIZATION_EXTENSIONS);

        const foundFiles = {};
        // foundFiles 객체 초기화 (각 확장자 키에 대해 빈 배열 할당)
        Object.keys(extensionFiles).forEach((key) => foundFiles[key] = []);
        foundFiles.other = []; // 기타 파일들을 위한 배열


        /** */
        if (OUTPUT_OPTION.CSS_MERGE_NAME ){
            if (!OUTPUT_OPTION.OPTIMIZATION_EXCLUDE.css) OUTPUT_OPTION.OPTIMIZATION_EXCLUDE.css = [];
            OUTPUT_OPTION.OPTIMIZATION_EXCLUDE.css.push(OUTPUT_OPTION.CSS_MERGE_NAME);
        }

        async function recurse(currentPath) {
            try {
                const entries = await fs.readdir(currentPath, { withFileTypes: true });
                for (const entry of entries) {
                    const filePath = path.join(currentPath, entry.name);
                    if (entry.isDirectory()) {
                        await recurse(filePath); // 재귀 호출
                    } else if (entry.isFile()) { // 파일인 경우에만 처리
                        const ext = path.extname(entry.name).toLowerCase();
                        let matchedCategory = false; // 파일이 특정 카테고리에 매칭되었는지 여부

                        // 정의된 확장자 카테고리들을 순회
                        for (const key of Object.keys(extensionFiles)) {
                            if (extensionFiles[key].includes(ext)) {
                                // 제외 조건 확인 및 continue
                                if (OUTPUT_OPTION.OPTIMIZATION_EXCLUDE &&
                                    OUTPUT_OPTION.OPTIMIZATION_EXCLUDE[key] &&
                                    OUTPUT_OPTION.OPTIMIZATION_EXCLUDE[key].some((e) => "" !== e && filePath.includes(e)))
                                {
                                    continue;
                                }

                                foundFiles[key].push(filePath);
                                matchedCategory = true;
                                break;
                            }
                        }

                        if (!matchedCategory) {
                            foundFiles.other.push(filePath);
                        }
                    }
                }
            } catch (error) {
                console.error(`Error processing path ${currentPath}: ${error.message}`);
            }
        }

        // 지정된 프로젝트 경로에서부터 재귀 탐색 시작
        if (OUTPUT_OPTION && OUTPUT_OPTION.PROJECT_PATH) {
            await recurse(OUTPUT_OPTION.PROJECT_PATH);
        } else {
            console.error("PROJECT_PATH is not defined in OUTPUT_OPTION.");
            return foundFiles; // 혹은 throw new Error("Project path not configured");
        }
        return foundFiles;
    }

    /**
     * javascript 경량화
     * */
    async function jsMinify(file, indicateFunc) {
        try {
            const code = await fs.readFile(file, 'utf8');
            const result = UglifyJS.minify(code, {compress: {drop_console: true}, mangle: true});
            if (result.error) {
                console.error(result.error);
                return;
            }

            const outputPath = generateOutputPath(file, 'js');
            await fs.writeFile(outputPath, result.code);
            logger.info(`JavaScript Minify Complete: ${outputPath}`);
        } catch (e) {
            console.error(e);
        }
    }


    /**
     * 이미지 경량화
     * */
    async function imgMinify(file) {
        try {
            const ext = path.extname(file).toLowerCase();
            const outputFilePath = generateOutputPath(file.replace(ext, OUTPUT_OPTION.IMAGE_EXTENSIONS), 'img');
            const image = Sharp(file).withMetadata();

            // 이미지 크기 확인
            const metadata = await image.metadata();
            const MAX_SIZE = 16383;

            if (metadata.width > MAX_SIZE || metadata.height > MAX_SIZE) {
                const resizeWidth = Math.min(metadata.width || MAX_SIZE, MAX_SIZE);
                const resizeHeight = Math.min(metadata.height || MAX_SIZE, MAX_SIZE);

                image.resize({
                    width: resizeWidth,
                    height: resizeHeight,
                    fit: 'inside' // 비율 유지
                });
            }
            await image
                .webp({ quality: OUTPUT_OPTION.IMAGE_QUALITY })
                .toFile(outputFilePath);

            CONVERT_IMAGE.push(outputFilePath);
            logger.info(`${file} -> ${outputFilePath} Conversion Complete.`);
        } catch (error) {
            logger.error(`${file} Convert Failed ${error.message}`);
        }
    }


    /**
     * CSS 경량화
     * */
    async function cssMinify(file) {
        try {
            const css = await fs.readFile(file, 'utf8');
            const outputFilePath = generateOutputPath(file, 'css');
            const result = await postcss([cssnano({preset: 'default'})]).process(css, {
                from: file,
                to: outputFilePath,
                parser: postcssScss
            });
            CONVERTED_CSS.push(outputFilePath);
            await fs.writeFile(outputFilePath, result.css);
            logger.info(`CSS Minify Complete: ${outputFilePath}`);
        } catch (error) {
            logger.error(`CSS Minify Failed (${file}): ${error.message}`);
        }
    }

    /**
     * 여러 CSS 파일 병합 및 경량화
     */
    async function mergeAndMinifyCss(files) {
        try {
            const genPath = generateOutputPath(files[0], 'css');
            const outputFilePath = path.join(path.dirname(genPath), OUTPUT_OPTION.CSS_MERGE_NAME + ".css")

            const mergedCss = await util.readAndMerge(files);

            const processed = await postcss([postcssSimpleVars, postcssNested])
                .process(mergedCss, { from: undefined });

            const minified = await postcss([cssnano({ preset: 'default' })])
                .process(processed.css, {
                    from: outputFilePath,
                    to: outputFilePath,
                    parser: postcssScss,
                });

            await fs.writeFile(outputFilePath, minified.css);
            CONVERTED_CSS.push(outputFilePath);
            logger.info(`CSS Merge and Minify Complete: ${outputFilePath}`);
        } catch (error) {
            logger.error(`CSS Processing Failed: ${error.message}, ${outputFilePath}`);

        }
    }



    /**
     * 전체 파일 복사
     * */
    async function otherFile(file) {
        try {
            const outputPath = generateOutputPath(file, 'other');
            await fs.copyFile(file, outputPath);
            logger.info(`File Copy Complete: ${outputPath}`);
        } catch (e) {
            logger.error(`File Copy Failed (${file}): ${e.message}`);
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
        try {
            let content = await fs.readFile(file, 'utf8');
            const regex = /<img[^>]?src=(['"]?)([^'"()<>]*(\.[a-zA-Z0-9]+))\1[^>]*>/g;
            const cssRegex = /url\(['"]?([^'"()]*(\.[a-zA-Z]+))['"]?\)/g;
            const ext = path.extname(file).toLowerCase();
            const fileRegx = [".css", ".scss"].some((e) => e === ext) ? cssRegex : regex;

            if (!fileRegx.test(content)) return;
            content = content.replace(fileRegx, (match, p1, p2) => {
                if (/https?/g.test(match)) return match;
                if (!CONVERT_IMAGE.some((e) => p1.includes(path.basename(e, path.extname(e))))) return match;
                return match.replace(p2, OUTPUT_OPTION.IMAGE_EXTENSIONS);
            });
            const outputPath = generateOutputPath(file, 'markup');
            await fs.writeFile(outputPath, content, "utf-8");
            logger.info(`${outputPath} : Changing Extension Complete`);
        } catch (err) {
            logger.error(`Changing Extension Failed: ${err.message}`);
        }
    }


    /**
     * 주어진 파일 경로(filePath)를 기반으로 출력용 파일 경로를 생성하는 함수.
     *
     * 작동 방식:
     * - OUTPUT_OPTION.IS_TEST 값에 따라 동작이 달라진다:
     *   1. 테스트 모드(false)인 경우:
     *      - 대상 경로(PROJECT_PATH)를 OUTPUT_OPTION.PATH로 교체하여 출력
     *   2. 테스트 모드가 아닌 경우(true):
     *      - 원본 파일명만 가져온 뒤(경로 제외) OUTPUT_OPTION.PATH, prefixDir, OUTPUT_OPTION.PREPEND를 조합하여 새로운 경로를 만든다.
     *      - 경량화 작업본만 확인 용도
     */
    function generateOutputPath(filePath, prefixDir = '') {
        if (!OUTPUT_OPTION.IS_TEST) {
            filePath = filePath.replace(OUTPUT_OPTION.PROJECT_PATH, OUTPUT_OPTION.PATH)
        } else {
            if (!filePath.includes(path.join(OUTPUT_OPTION.PATH))) {
                const fileName = path.basename(filePath)
                filePath = path.join(OUTPUT_OPTION.PATH, prefixDir, OUTPUT_OPTION.PREPEND + fileName)
            }
        }

        const directory = path.dirname(filePath); // 폴더 경로 추출

        // 폴더가 존재하지 않으면 생성
        if (!existsSync(directory)) {
            mkdirSync(directory, { recursive: true }); // recursive: 하위 폴더까지 생성
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
            await Promise.allSettled(batch.map( async (file) => {
                await processFunction(file);
                indicateFunc.update()
            }));
        }
    }


    return {
        findFilesByExtensions,
        jsMinify,
        imgMinify,
        cssMinify,
        mergeAndMinifyCss,
        otherFile,
        replaceExtensions,

        processBatch,
    }
}

const util = (() => {
    const logger = new Logger(true);

    /**
     * 파일을 읽고 한개로 합치기
     * * */
    async function readAndMerge(files) {
        let merged = '';

        for (const file of files) {
            try {
                const content = await fs.readFile(file, 'utf8');
                merged += content + '\n'; // 파일 간 줄 구분
            } catch (error) {
                logger.error(`Failed to read file: ${file}, ${error.message}`);
            }
        }

        return merged;
    }

    return {
        readAndMerge
    }
})()