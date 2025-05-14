## Web Optimizer
Node기반 프로젝트로 특정 경로 하위에 리소스를 찾고 최적화(이미지, JS , CSS Minify) 및 HTML, CSS 내 이미지 경로를 수정하는 프로젝트입니다.<br>
| Key | Type | default | description
| --- | --- | --- | --- |
| IS_TEST | Boolean | true | true - 최적화 작업물 확인용 프로젝트 경로에 영향도 없음<br> (PATH 경로에 작업물 별 디렉터리로 출력) <br> false - 프로젝트 하위 디렉터리를 전부 PATH 경로에 복사 |
| IS_LOG | Boolean | true | 콘솔창 작업 로그 출력 여부 |
| PROJECT_PATH | String |  | 최적화 대상 프로젝트 |
| OPTIMIZATION_EXTENSIONS | Object |  | 최적화 확장자 지정 {script: [], image: [], css: []} 타입에 맞게 지정 |
| OPTIMIZATION_EXCLUDE | Object |  | 최적화 예외 처리 {script: [], image: [], css: []} 타입에 맞게 예외 경로를 지정 <br> 파일 경로에 includes로 체크하니 되도록 전체 경로로 작성 요망  |
| IMAGE_QUALITY | Number | 80 | 이미지 변환 퀄리티 지정 |
| <s>IMAGE_EXTENSIONS </s>| <s>String </s>| <s> .webp</s> | <s>이미지 경량화 할 확장자</s>  현재 .webp 변환 고정 |
| PATH | String | ./.output/ | 작업물 출력 경로 |
| PREPEND | String |  | 변환 파일에 앞에 붙일 문자열 (IS_TEST = true 일 경우만 작동) |
| BATCH_SIZE | Number | 100 | 최적화 작업 크기 |

<br>   



## Start

#### 1. 해당 프로젝트를 복제 및 패키지 설치
```
$ git clone https://github.com/3jay-jun/node_web_optimizer.git
$ cd node_web_optimizer
$ npm install
```
<br>   

#### 2. 필수 옵션 설정 - node_web_optimizer/src/index.js 수정
```js
    // 탐색을 시작할 경로 (예시)
    PROJECT_PATH : 'D://project//example', 

    // 최적화 작업 확장자 지정 (예시)
    OPTIMIZATION_EXTENSIONS : { 
        "script" : ['.js'],
        "image" : ['.png', '.jpg', '.jpeg', '.gif'],
        "css" : ['.css'],
    },

    // 최적화 예외 처리할 경로 지정 (예시) 
    OPTIMIZATION_EXCLUDE: { 
        "script" : [ 'common\\js\\main.js', 'common\\js\\common.js', 'common\\js\\site.js'],
        "image" : ['fullcalendar', 'newsletter'],
        "css": ['']
    }, 
```
<br>

#### 3. 실행
```
$ npm run start
```

<br>
<br>

## Library
- [sharp - 0.33.5](https://sharp.pixelplumbing.com/)
- [CSSnano - 7.0.6](https://github.com/cssnano/cssnano)
- [UglifyJS - 3.19.3](https://github.com/mishoo/UglifyJS)

>[ 작업 환경 ] <br> Windows 11 Pro<br> Node - v22.14.0  <br> Npm - 11.3.0


