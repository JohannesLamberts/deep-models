import {
    DeepModelFilterFieldConstraintDistinct,
    DeepModelFilterJSONDistinct,
    DeepModelFilterMongoFieldDistinct,
    EDeepModelFilterDistinctMode
} from './contraints/distinct';
import {
    DeepModelFilterFieldConstraintRANGE,
    DeepModelFilterJSONRange,
    DeepModelFilterMongoFieldRange
} from './contraints/range';

export interface DeepModelFilterJSONField<TVal> {
    distinct?: DeepModelFilterJSONDistinct<TVal>;
    range?: DeepModelFilterJSONRange<TVal>;
}

export interface DeepModelFilterMongoField extends DeepModelFilterMongoFieldDistinct, DeepModelFilterMongoFieldRange {
}

export type TDeepModelCompare = keyof DeepModelFilterMongoField;

export interface DeepModelFilterConstraint {
    clone: () => DeepModelFilterConstraint;
    passes: (value: any) => boolean;
    isFullfillable: () => boolean;
    isAlwaysFullfilled: () => boolean;
    toMongo: () => DeepModelFilterMongoField;
    toJSON: () => any;
}

export class DeepModelFilterField<TVal> implements DeepModelFilterConstraint {

    private _distinct = new DeepModelFilterFieldConstraintDistinct<TVal>();
    private _range = new DeepModelFilterFieldConstraintRANGE<TVal>();

    public static fromJSON<TVal>(json: DeepModelFilterJSONField<TVal>) {
        const newObj = new DeepModelFilterField<TVal>();
        if (json.distinct) {
            newObj._distinct = DeepModelFilterFieldConstraintDistinct.fromJSON(json.distinct);
        }
        if (json.range) {
            newObj._range = DeepModelFilterFieldConstraintRANGE.fromJSON(json.range);
        }
        return newObj;
    }

    public clone(): DeepModelFilterField<TVal> {
        const copy = new DeepModelFilterField<TVal>();
        copy._distinct = this._distinct.clone();
        copy._range = this._range.clone();
        return copy;
    }

    public passes(value: TVal): boolean {
        return this._distinct.passes(value) && this._range.passes(value);
    }

    public isFullfillable(): boolean {
        return this._distinct.isFullfillable() && this._range.isFullfillable();
    }

    public isAlwaysFullfilled(): boolean {
        return this._distinct.isAlwaysFullfilled() && this._range.isAlwaysFullfilled();
    }

    public toMongo(): DeepModelFilterMongoField {
        return {
            ...this._distinct.toMongo(),
            ...this._range.toMongo()
        };
    }

    public toJSON(): DeepModelFilterJSONField<TVal> {
        const json: DeepModelFilterJSONField<TVal> = {};
        if (!this._distinct.isAlwaysFullfilled()) {
            json.distinct = this.getDistinct().toJSON();
        }
        if (!this.getRange().isAlwaysFullfilled()) {
            json.range = this.getRange().toJSON();
        }
        return json;
    }

    public subtractFromCloneOf(fieldClone: () => DeepModelFilterField<TVal>) {
        this._distinct.subtractFromCloneOf(() => fieldClone().getDistinct());
        this._range.subtractFromCloneOf(() => fieldClone().getRange());
    }

    public getDistinct(): DeepModelFilterFieldConstraintDistinct<TVal> {
        return this._distinct;
    }

    public getRange(): DeepModelFilterFieldConstraintRANGE<TVal> {
        return this._range;
    }

    public add(type: TDeepModelCompare, value: TVal | TVal[]): /*fullfillable*/ boolean {
        if (this.isFullfillable()) {
            switch (type) {
                case '$in':
                    this._distinct.andDistinct(EDeepModelFilterDistinctMode.eIN, value as TVal[]);
                    break;
                case '$eq':
                    this._distinct.andDistinct(EDeepModelFilterDistinctMode.eIN, [value as TVal]);
                    break;
                case '$nin':
                    this._distinct.andDistinct(EDeepModelFilterDistinctMode.eNIN, value as TVal[]);
                    break;
                case '$ne':
                    this._distinct.andDistinct(EDeepModelFilterDistinctMode.eNIN, [value as TVal]);
                    break;
                case '$lt':
                    this._range.andLT(value as TVal);
                    break;
                case '$lte':
                    this._range.andLTE(value as TVal);
                    break;
                case '$gt':
                    this._range.andGT(value as TVal);
                    break;
                case '$gte':
                    this._range.andGTE(value as TVal);
                    break;
                default:
                    throw new Error(`Compare type doesn't exist: ${value}`);
            }
            this.simplify();
        }
        return this.isFullfillable();
    }

    public simplify(): void {
        this._distinct.andRange(this._range);
        // reset range if IN, because all relements will be filtered by distinct values
        if (this._distinct.getMode() === EDeepModelFilterDistinctMode.eIN) {
            this._range = new DeepModelFilterFieldConstraintRANGE();
        }
    }
}