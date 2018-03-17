import { EFieldType } from './description';
import DescField      from './description/field';

export abstract class AbstractDescFReference<T> extends DescField<T> {

    get refTarget() {
        return this._refTarget;
    }

    constructor(label: string, protected _refTarget: string, isArr: boolean = false) {
        super(label, EFieldType.eReference, isArr);
    }
}

export class DescFReference extends AbstractDescFReference<string> {
}

export class DescFReferenceArr extends AbstractDescFReference<string[]> {
    constructor(label: string, refTarget: string) {
        super(label, refTarget, true);
    }
}