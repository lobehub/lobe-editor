import EventEmitter from "eventemitter3";

export abstract class KernelPlugin extends EventEmitter {
    protected clears: Array<() => void> = [];

    protected register(clear: () => void): void {
        this.clears.push(clear);
    }

    protected registerClears(...clears: Array<() => void>): void {
        clears.forEach(clear => this.register(clear));
    }

    public destroy(): void {
        this.clears.forEach(clear => clear());
    }
}
