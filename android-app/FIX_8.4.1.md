# 8.4.1 MainActivity Kotlin compile fix

오류:
MainActivity.kt:650:36 Unresolved reference 'g'

원인:
Kotlin triple-quoted JavaScript 문자열 안에 JavaScript template literal
`${g.length}`가 들어가 있어 Kotlin이 `${...}`를 Kotlin 문자열 보간으로 해석함.

수정:
JavaScript template literal을 문자열 연결 방식으로 변경.

기존:
const key=`${g.length}:${first?.[0]}:${first?.[1]}:${last?.[0]}:${last?.[1]}`;

수정:
const key=String(g.length)+':'+String(first?.[0])+':'+String(first?.[1])+':'+String(last?.[0])+':'+String(last?.[1]);

따라서 Kotlin 컴파일러가 JavaScript 변수 g를 Kotlin 변수로 해석하지 않음.
