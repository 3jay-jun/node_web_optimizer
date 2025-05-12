export default class Indicator {
    constructor(total, namespace) {
        this.total = total;
        this.completedCnt = 0;

        this.namespace = namespace
    }

    getTotal() {
        return this.total;
    }
    setTotal(newTotal) {
        this.total = newTotal;
    }

    update() {
        ++this.completedCnt
        this.print()
    }
    print() {
        process.stdout.write(`\r ${this.namespace} 파일 - ${this.completedCnt.toLocaleString()}/${this.total.toLocaleString()} 완료`);
        if(this.completedCnt === this.total) console.log(`\r ${this.namespace} 파일 총 ${this.total.toLocaleString()}개 중 ${this.completedCnt.toLocaleString()} 작업 완료`)
    }

}
