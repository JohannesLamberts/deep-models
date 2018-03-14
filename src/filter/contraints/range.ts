import { DeepModelFilterConstraint } from '../filterField';

export enum EDeepModelFilterRangeMode {
    eLtGt   = 0, // Caution: eLtGt must be < LteGte for Math.min in andRange
    eLteGte = 1
}

export interface DeepModelFilterMongoFieldRange {
    $gt?: any;
    $gte?: any;
    $lt?: any;
    $lte?: any;
}

export interface DeepModelFilterJSONRange<TVal> {
    lt?: {
        val: TVal;
        eq: boolean;
    };
    gt?: {
        val: TVal;
        eq: boolean;
    };
}

export class DeepModelFilterFieldConstraintRANGE<TVal> implements DeepModelFilterConstraint {

    private _lt: TVal | null = null;     // max
    private _ltMode = EDeepModelFilterRangeMode.eLteGte;
    private _gt: TVal | null = null;     // min
    private _gtMode = EDeepModelFilterRangeMode.eLteGte;

    public static fromJSON<TVal>(json: DeepModelFilterJSONRange<TVal>): DeepModelFilterFieldConstraintRANGE<TVal> {
        const newObj = new DeepModelFilterFieldConstraintRANGE<TVal>();
        if (json.lt) {
            newObj._lt = json.lt.val;
            newObj._ltMode = json.lt.eq
                ? EDeepModelFilterRangeMode.eLteGte
                : EDeepModelFilterRangeMode.eLtGt;
        }
        if (json.gt) {
            newObj._gt = json.gt.val;
            newObj._gtMode = json.gt.eq
                ? EDeepModelFilterRangeMode.eLteGte
                : EDeepModelFilterRangeMode.eLtGt;
        }
        return newObj;
    }

    public clone(): DeepModelFilterFieldConstraintRANGE<TVal> {
        const copy = new DeepModelFilterFieldConstraintRANGE<TVal>();
        copy._lt = this._lt;
        copy._ltMode = this._ltMode;
        copy._gt = this._gt;
        copy._gtMode = this._gtMode;
        return copy;
    }

    public passes(value: any): boolean {
        if (this._lt !== null) {
            if (this._ltMode === EDeepModelFilterRangeMode.eLtGt) {
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
            if (this._gtMode === EDeepModelFilterRangeMode.eLtGt) {
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
            if (this._ltMode === EDeepModelFilterRangeMode.eLteGte
                && this._gtMode === EDeepModelFilterRangeMode.eLteGte) {
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

    public toMongo(): DeepModelFilterMongoFieldRange {
        if (this.isAlwaysFullfilled()) {
            return {};
        }
        const rangeFilter: DeepModelFilterMongoFieldRange = {};
        if (this._lt != null) {
            if (this._ltMode === EDeepModelFilterRangeMode.eLtGt) {
                rangeFilter.$lt = this._lt;
            } else {
                rangeFilter.$lte = this._lt;
            }
        }
        if (this._gt != null) {
            if (this._gtMode === EDeepModelFilterRangeMode.eLtGt) {
                rangeFilter.$gt = this._gt;
            } else {
                rangeFilter.$gte = this._gt;
            }
        }
        return rangeFilter;
    }

    public toJSON(): DeepModelFilterJSONRange<TVal> {
        const json: DeepModelFilterJSONRange<TVal> = {};
        if (this._lt !== null) {
            json.lt = {
                val: this._lt,
                eq: this._ltMode === EDeepModelFilterRangeMode.eLteGte
            };
        }
        if (this._gt !== null) {
            json.gt = {
                val: this._gt,
                eq: this._gtMode === EDeepModelFilterRangeMode.eLteGte
            };
        }
        return json;
    }

    public subtractFromCloneOf(newRangeField: () => DeepModelFilterFieldConstraintRANGE<TVal>): void {
        if (this._lt !== null) {
            const clone = newRangeField();
            if (this._ltMode === EDeepModelFilterRangeMode.eLtGt) {
                clone.andGTE(this._lt);
            } else {
                clone.andGT(this._lt);
            }
        }
        if (this._gt !== null) {
            const clone = newRangeField();
            if (this._ltMode === EDeepModelFilterRangeMode.eLtGt) {
                clone.andLTE(this._gt);
            } else {
                clone.andLT(this._gt);
            }
        }
    }

    public andLT(newValue: TVal): void {
        if (this._lt === null || newValue <= this._lt) {
            this._lt = newValue;
            this._ltMode = EDeepModelFilterRangeMode.eLtGt;
        }
    }

    public andLTE(newValue: TVal): void {
        if (this._lt === null || newValue < this._lt) {
            this._lt = newValue;
            this._ltMode = EDeepModelFilterRangeMode.eLteGte;
        }
    }

    public andGT(newValue: TVal): void {
        if (this._gt === null || newValue >= this._gt) {
            this._gt = newValue;
            this._gtMode = EDeepModelFilterRangeMode.eLtGt;
        }
    }

    public andGTE(newValue: TVal): void {
        if (this._gt === null || newValue > this._gt) {
            this._gt = newValue;
            this._gtMode = EDeepModelFilterRangeMode.eLteGte;
        }
    }
}