import { ModelFilterConstraint } from '../filterField';

export enum EModelFilterRangeMode {
    eLtGt   = 0, // Caution: eLtGt must be < LteGte for Math.min in andRange
    eLteGte = 1
}

export interface ModelFilterMongoFieldRange {
    $gt?: any;
    $gte?: any;
    $lt?: any;
    $lte?: any;
}

export interface ModelFilterJSONRange<TVal> {
    lt?: {
        val: TVal;
        eq: boolean;
    };
    gt?: {
        val: TVal;
        eq: boolean;
    };
}

export class ModelFilterFieldConstraintRANGE<TVal> implements ModelFilterConstraint {

    private _lt: TVal | null = null;     // max
    private _ltMode = EModelFilterRangeMode.eLteGte;
    private _gt: TVal | null = null;     // min
    private _gtMode = EModelFilterRangeMode.eLteGte;

    public static fromJSON<TVal>(json: ModelFilterJSONRange<TVal>): ModelFilterFieldConstraintRANGE<TVal> {
        const newObj = new ModelFilterFieldConstraintRANGE<TVal>();
        if (json.lt) {
            newObj._lt = json.lt.val;
            newObj._ltMode = json.lt.eq
                ? EModelFilterRangeMode.eLteGte
                : EModelFilterRangeMode.eLtGt;
        }
        if (json.gt) {
            newObj._gt = json.gt.val;
            newObj._gtMode = json.gt.eq
                ? EModelFilterRangeMode.eLteGte
                : EModelFilterRangeMode.eLtGt;
        }
        return newObj;
    }

    public clone(): ModelFilterFieldConstraintRANGE<TVal> {
        const copy = new ModelFilterFieldConstraintRANGE<TVal>();
        copy._lt = this._lt;
        copy._ltMode = this._ltMode;
        copy._gt = this._gt;
        copy._gtMode = this._gtMode;
        return copy;
    }

    public passes(value: any): boolean {
        if (this._lt !== null) {
            if (this._ltMode === EModelFilterRangeMode.eLtGt) {
                if (value > this._lt) {
                    return false;
                }
            } else {
                if (value >= this._lt) {
                    return false;
                }
            }
        }
        if (this._gt !== null) {
            if (this._gtMode === EModelFilterRangeMode.eLtGt) {
                if (value < this._gt) {
                    return false;
                }
            } else {
                if (value <= this._gt) {
                    return false;
                }
            }
        }
        return true;
    }

    public isFullfillable(): boolean {
        if (this._lt != null && this._gt != null) {
            if (this._ltMode === EModelFilterRangeMode.eLteGte
                && this._gtMode === EModelFilterRangeMode.eLteGte) {
                return this._lt >= this._gt;
            } else {
                return this._lt > this._gt;
            }
        }
        return true;
    }

    public isAlwaysFullfilled(): boolean {
        return this._lt === null && this._gt === null;
    }

    public toMongo(): ModelFilterMongoFieldRange {
        if (this.isAlwaysFullfilled()) {
            return {};
        }
        const rangeFilter: ModelFilterMongoFieldRange = {};
        if (this._lt != null) {
            if (this._ltMode === EModelFilterRangeMode.eLtGt) {
                rangeFilter.$lt = this._lt;
            } else {
                rangeFilter.$lte = this._lt;
            }
        }
        if (this._gt != null) {
            if (this._gtMode === EModelFilterRangeMode.eLtGt) {
                rangeFilter.$gt = this._gt;
            } else {
                rangeFilter.$gte = this._gt;
            }
        }
        return rangeFilter;
    }

    public toJSON(): ModelFilterJSONRange<TVal> {
        const json: ModelFilterJSONRange<TVal> = {};
        if (this._lt !== null) {
            json.lt = {
                val: this._lt,
                eq: this._ltMode === EModelFilterRangeMode.eLteGte
            };
        }
        if (this._gt !== null) {
            json.gt = {
                val: this._gt,
                eq: this._gtMode === EModelFilterRangeMode.eLteGte
            };
        }
        return json;
    }

    public subtractFromCloneOf(newRangeField: () => ModelFilterFieldConstraintRANGE<TVal>): void {
        if (this._lt !== null) {
            const clone = newRangeField();
            if (this._ltMode === EModelFilterRangeMode.eLtGt) {
                clone.andGTE(this._lt);
            } else {
                clone.andGT(this._lt);
            }
        }
        if (this._gt !== null) {
            const clone = newRangeField();
            if (this._ltMode === EModelFilterRangeMode.eLtGt) {
                clone.andLTE(this._gt);
            } else {
                clone.andLT(this._gt);
            }
        }
    }

    public andLT(newValue: TVal): void {
        if (this._lt === null || newValue <= this._lt) {
            this._lt = newValue;
            this._ltMode = EModelFilterRangeMode.eLtGt;
        }
    }

    public andLTE(newValue: TVal): void {
        if (this._lt === null || newValue < this._lt) {
            this._lt = newValue;
            this._ltMode = EModelFilterRangeMode.eLteGte;
        }
    }

    public andGT(newValue: TVal): void {
        if (this._gt === null || newValue >= this._gt) {
            this._gt = newValue;
            this._gtMode = EModelFilterRangeMode.eLtGt;
        }
    }

    public andGTE(newValue: TVal): void {
        if (this._gt === null || newValue > this._gt) {
            this._gt = newValue;
            this._gtMode = EModelFilterRangeMode.eLteGte;
        }
    }
}