import {
    EModelFilterDistinctMode,
    ModelFilterFieldConstraintDistinct,
    ModelFilterJSONDistinct,
    ModelFilterMongoFieldDistinct
} from './contraints/distinct';
import {
    ModelFilterFieldConstraintRANGE,
    ModelFilterJSONRange,
    ModelFilterMongoFieldRange
} from './contraints/range';

export interface ModelFilterJSONField<TVal> {
    distinct?: ModelFilterJSONDistinct<TVal>;
    range?: ModelFilterJSONRange<TVal>;
}

export interface ModelFilterMongoField extends ModelFilterMongoFieldDistinct, ModelFilterMongoFieldRange {
}

export type TModelCompare = keyof ModelFilterMongoField;

export interface ModelFilterConstraint {
    clone: () => ModelFilterConstraint;
    passes: (value: any) => boolean;
    isFullfillable: () => boolean;
    isAlwaysFullfilled: () => boolean;
    toMongo: () => ModelFilterMongoField;
    toJSON: () => any;
}

export class ModelFilterField<TVal> implements ModelFilterConstraint {

    private _distinct = new ModelFilterFieldConstraintDistinct<TVal>();
    private _range = new ModelFilterFieldConstraintRANGE<TVal>();

    public static fromJSON<TVal>(json: ModelFilterJSONField<TVal>) {
        const newObj = new ModelFilterField<TVal>();
        if (json.distinct) {
            newObj._distinct = ModelFilterFieldConstraintDistinct.fromJSON(json.distinct);
        }
        if (json.range) {
            newObj._range = ModelFilterFieldConstraintRANGE.fromJSON(json.range);
        }
        return newObj;
    }

    public clone(): ModelFilterField<TVal> {
        const copy = new ModelFilterField<TVal>();
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

    public toMongo(): ModelFilterMongoField {
        return {
            ...this._distinct.toMongo(),
            ...this._range.toMongo()
        };
    }

    public toJSON(): ModelFilterJSONField<TVal> {
        const json: ModelFilterJSONField<TVal> = {};
        if (!this._distinct.isAlwaysFullfilled()) {
            json.distinct = this.getDistinct().toJSON();
        }
        if (!this.getRange().isAlwaysFullfilled()) {
            json.range = this.getRange().toJSON();
        }
        return json;
    }

    public subtractFromCloneOf(fieldClone: () => ModelFilterField<TVal>) {
        this._distinct.subtractFromCloneOf(() => fieldClone().getDistinct());
        this._range.subtractFromCloneOf(() => fieldClone().getRange());
    }

    public getDistinct(): ModelFilterFieldConstraintDistinct<TVal> {
        return this._distinct;
    }

    public getRange(): ModelFilterFieldConstraintRANGE<TVal> {
        return this._range;
    }

    public add(type: TModelCompare, value: TVal | TVal[]): /*fullfillable*/ boolean {
        if (this.isFullfillable()) {
            switch (type) {
                case '$in':
                    this._distinct.andDistinct(EModelFilterDistinctMode.eIN, value as TVal[]);
                    break;
                case '$eq':
                    this._distinct.andDistinct(EModelFilterDistinctMode.eIN, [value as TVal]);
                    break;
                case '$nin':
                    this._distinct.andDistinct(EModelFilterDistinctMode.eNIN, value as TVal[]);
                    break;
                case '$ne':
                    this._distinct.andDistinct(EModelFilterDistinctMode.eNIN, [value as TVal]);
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
        if (this._distinct.getMode() === EModelFilterDistinctMode.eIN) {
            this._range = new ModelFilterFieldConstraintRANGE();
        }
    }
}