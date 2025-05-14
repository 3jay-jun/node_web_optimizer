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
        process.stdout.write(`\r ${this.namespace} FILE - ${this.completedCnt.toLocaleString()} / ${this.total.toLocaleString()} `);
        if(this.completedCnt === this.total) console.log(`\r ${this.namespace} FILE - ${this.total.toLocaleString()} / ${this.completedCnt.toLocaleString()} Complete.`)
    }

}
