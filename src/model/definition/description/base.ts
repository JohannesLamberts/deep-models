export enum EDescType {
    eField,
    eArea
}

export abstract class DescKeyBase {

    constructor(private _label: string,
                private _type: EDescType) {
    }

    public isArea() {
        return this._type === EDescType.eArea;
    }

    public isField() {
        return this._type === EDescType.eField;
    }

    public getLabel(): string {
        return this._label;
    }
}