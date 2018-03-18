import { FnArraySet }                      from '../../_util/arraySet';
import { ModelFilterConstraint }           from '../filterField';
import { ModelFilterFieldConstraintRANGE } from './range';

export enum EModelFilterDistinctMode {
    eIN,
    eNIN
}

export interface ModelFilterMongoFieldDistinct {
    $eq?: any;
    $in?: any;
    $ne?: any;
    $nin?: any;
}

export interface ModelFilterJSONDistinct<TVal> {
    mode: EModelFilterDistinctMode;
    filterValues: TVal[];
}

export class ModelFilterFieldConstraintDistinct<TVal> implements ModelFilterConstraint {

    private _mode = EModelFilterDistinctMode.eNIN;
    private _filterValues: TVal[] = [];

    public static fromJSON<TVal>(json: ModelFilterJSONDistinct<TVal>) {
        const newObj = new ModelFilterFieldConstraintDistinct<TVal>();
        newObj._mode = json.mode;
        newObj._filterValues = json.filterValues;
        return newObj;
    }

    public clone(): ModelFilterFieldConstraintDistinct<TVal> {
        const copy = new ModelFilterFieldConstraintDistinct<TVal>();
        copy._mode = this._mode;
        copy._filterValues = copy._filterValues.slice();
        return copy;
    }

    public passes(value: any): boolean {
        const inFilter = this._filterValues.some(val => val === value);
        return this._mode === EModelFilterDistinctMode.eIN
            ? inFilter
            : !inFilter;
    }

    public isFullfillable(): boolean {
        if (this._mode === EModelFilterDistinctMode.eNIN) {
            // always isFullfillable if NIN
            return true;
        } else {
            // else isFullfillable, if array not empty
            return this._filterValues.length !== 0;
        }
    }

    public isAlwaysFullfilled(): boolean {
        if (this._mode === EModelFilterDistinctMode.eNIN) {
            return this._filterValues.length === 0;
        } else {
            return false;
        }
    }

    public toMongo(): ModelFilterMongoFieldDistinct {
        if (this.isAlwaysFullfilled()) {
            return {};
        }
        if (this._mode === EModelFilterDistinctMode.eIN) {
            return this._filterValues.length === 1
                ? { $eq: this._filterValues[0] }
                : { $in: this._filterValues };
        } else {
            return this._filterValues.length === 1
                ? { $ne: this._filterValues[0] }
                : { $nin: this._filterValues };
        }
    }

    public toJSON(): ModelFilterJSONDistinct<TVal> {
        return {
            mode: this._mode,
            filterValues: this._filterValues
        };
    }

    public subtractFromCloneOf(newDistinctField: () => ModelFilterFieldConstraintDistinct<TVal>) {
        if (this.isAlwaysFullfilled()) {
            return;
        }
        this._filterValues.forEach(value => {
            const inverseMode = this._mode === EModelFilterDistinctMode.eIN
                ? EModelFilterDistinctMode.eNIN
                : EModelFilterDistinctMode.eIN;
            newDistinctField().andDistinct(inverseMode, [value]);
        });
    }

    public getMode(): EModelFilterDistinctMode {
        return this._mode;
    }

    // this     AND     new
    // NIN      AND     NIN     -> NIN(this + new)
    // NIN      AND     IN      -> IN(new - this)       ! inverse negate
    // IN       AND     NIN     -> IN(this - new)
    // IN       AND     IN      -> IN(Schnittmenge(this,new))
    public andDistinct(newMode: EModelFilterDistinctMode, newFilterValues: TVal[]): void {
        const thisNeg = this._mode === EModelFilterDistinctMode.eNIN;
        const newNeg = newMode === EModelFilterDistinctMode.eNIN;
        if (thisNeg && newNeg) {           // NIN && NIN -> NIN
            this._filterValues = FnArraySet.union(this._filterValues, newFilterValues);
        } else if (thisNeg && !newNeg) {   // NIN && IN -> IN
            this._filterValues = FnArraySet.aWithoutB(newFilterValues, this._filterValues);
            this._mode = EModelFilterDistinctMode.eIN;
        } else if (!thisNeg && newNeg) {   // IN && NIN -> IN
            this._filterValues = FnArraySet.aWithoutB(this._filterValues, newFilterValues);
        } else if (!thisNeg && !newNeg) {  // IN && IN -> IN
            this._filterValues = FnArraySet.intersection(this._filterValues, newFilterValues);
        }
    }

    public andRange(constraint: ModelFilterFieldConstraintRANGE<TVal>): void {
        // keep only those, who pass range filter
        // in case of  IN: remove range afterwards, all allowed elements are in filterValue
        // in case of NIN: don't remove range, values that do not pass range filter are not needed anymore,
        //                                        since they will still be filtered by range
        this._filterValues = this._filterValues.filter(val => constraint.passes(val));
    }
}