import path from "path";
import Indicator from './util/indicator.js';
import { process, CONVERTED_CSS } from './process.js';
import Logger from "./util/logger.js";

const {findFilesByExtensions, jsMinify, imgMinify, cssMinify, otherFile, replaceExtensions, processBatch } = process({
    /**
     * IS_TEST
     * true = 대상 경로(PROJECT_PATH)의 폴더 구조와 동일한 경로로 PATH 경로에 복사
     * false = 경량화 작업본 확인 용도
     * */
    IS_TEST: false,

    /** 작업 중 로그 출력 여부 */
    IS_LOG: true,

    /** 최적화 작업 경로  */
    PROJECT_PATH : 'C:\\Users\\Desktop\\test', // 탐색을 시작할 경로

    /** 최적화 확장자  */
    OPTIMIZATION_EXTENSIONS : {
        "script" : ['.js'],
        "image" : ['.png', '.jpg', '.jpeg', '.gif'],
        "css" : ['.css', '.scss'],
    },

    /** 최적화 예외 처리 */
    OPTIMIZATION_EXCLUDE: {
        "script" : ['controller', 'ezController', 'ezFile', 'ezValidation', 'common\\js\\main.js', 'common\\js\\common.js', 'common\\js\\site.js'],
        "image" : ['\\common\\newsletter'],
        "css": ['']
    },

    /** 이미지 퀄리티 설정 */
    IMAGE_QUALITY: 80,
    IMAGE_EXTENSIONS: '.webp',

    /** 작업물 출력 */
    PATH: './.output/',      // 결과물 출력 경로
    PREPEND: '',      // 파일 앞에 붙이고 싶은 TEXT


    /** System Options*/
    BATCH_SIZE: 100, // 배치 크기 설정
})


findFilesByExtensions().then(async (findFiles) => {
    const logger = new Logger(true);
    try {
        const findTotal = Object.values(findFiles).reduce((prev, next) => prev + next.length, 0);
        logger.info('////////////////////////////////////////')
        Object.keys(findFiles).forEach((key) => {
            logger.info(key + " - Total " + findFiles[key].length + "")
        })
        logger.info('////////////////////////////////////////')


        // JavaScript 파일 최적화
        if (findFiles.script && findFiles.script.length > 0) {
            await processBatch(findFiles.script, jsMinify, new Indicator(findFiles.script.length, "script"));
        }

        // CSS 파일 최적화
        if (findFiles.css && findFiles.css.length > 0) {
            await processBatch(findFiles.css, cssMinify, new Indicator(findFiles.css.length, "css"));
        }

        // 이미지 파일 최적화
        if (findFiles.image && findFiles.image.length > 0) {
            await processBatch(findFiles.image, imgMinify, new Indicator(findFiles.image.length, "이미지"));
        }

        // 기타 파일 복사
        if (findFiles.other && findFiles.other.length > 0) {
            await processBatch(findFiles.other, otherFile, new Indicator(findFiles.other.length, "기타"));
        }

        // HTML/JSP/CSS/SCSS 파일 확장자 치환
        if (findFiles.markup && findFiles.markup.length > 0) {
            if (CONVERTED_CSS && CONVERTED_CSS.length) {
                findFiles.markup = [...findFiles.markup, ...CONVERTED_CSS];
            }
            await processBatch(findFiles.markup, replaceExtensions, new Indicator(findFiles.markup.length, "HTML/JSP/CSS/SCSS"));
        }

    } catch (e) {
        console.error(e)
    }
})