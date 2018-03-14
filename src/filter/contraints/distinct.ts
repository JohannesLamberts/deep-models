import { FnArraySet }                          from '../../_util/arraySet';
import { DeepModelFilterConstraint }           from '../filterField';
import { DeepModelFilterFieldConstraintRANGE } from './range';

export enum EDeepModelFilterDistinctMode {
    eIN,
    eNIN
}

export interface DeepModelFilterMongoFieldDistinct {
    $eq?: any;
    $in?: any;
    $ne?: any;
    $nin?: any;
}

export interface DeepModelFilterJSONDistinct<TVal> {
    mode: EDeepModelFilterDistinctMode;
    filterValues: TVal[];
}

export class DeepModelFilterFieldConstraintDistinct<TVal> implements DeepModelFilterConstraint {

    private _mode = EDeepModelFilterDistinctMode.eNIN;
    private _filterValues: TVal[] = [];

    public static fromJSON<TVal>(json: DeepModelFilterJSONDistinct<TVal>) {
        const newObj = new DeepModelFilterFieldConstraintDistinct<TVal>();
        newObj._mode = json.mode;
        newObj._filterValues = json.filterValues;
        return newObj;
    }

    public clone(): DeepModelFilterFieldConstraintDistinct<TVal> {
        const copy = new DeepModelFilterFieldConstraintDistinct<TVal>();
        copy._mode = this._mode;
        copy._filterValues = copy._filterValues.slice();
        return copy;
    }

    public passes(value: any): boolean {
        const inFilter = this._filterValues.some(val => val === value);
        return this._mode === EDeepModelFilterDistinctMode.eIN
            ? inFilter
            : !inFilter;
    }

    public isFullfillable(): boolean {
        if (this._mode === EDeepModelFilterDistinctMode.eNIN) {
            // always isFullfillable if NIN
            return true;
        } else {
            // else isFullfillable, if array not empty
            return this._filterValues.length !== 0;
        }
    }

    public isAlwaysFullfilled(): boolean {
        if (this._mode === EDeepModelFilterDistinctMode.eNIN) {
            return this._filterValues.length === 0;
        } else {
            return false;
        }
    }

    public toMongo(): DeepModelFilterMongoFieldDistinct {
        if (this.isAlwaysFullfilled()) {
            return {};
        }
        if (this._mode === EDeepModelFilterDistinctMode.eIN) {
            return this._filterValues.length === 1
                ? { $eq: this._filterValues[0] }
                : { $in: this._filterValues };
        } else {
            return this._filterValues.length === 1
                ? { $ne: this._filterValues[0] }
                : { $nin: this._filterValues };
        }
    }

    public toJSON(): DeepModelFilterJSONDistinct<TVal> {
        return {
            mode: this._mode,
            filterValues: this._filterValues
        };
    }

    public subtractFromCloneOf(newDistinctField: () => DeepModelFilterFieldConstraintDistinct<TVal>) {
        if (this.isAlwaysFullfilled()) {
            return;
        }
        this._filterValues.forEach(value => {
            const inverseMode = this._mode === EDeepModelFilterDistinctMode.eIN
                ? EDeepModelFilterDistinctMode.eNIN
                : EDeepModelFilterDistinctMode.eIN;
            newDistinctField().andDistinct(inverseMode, [value]);
        });
    }

    public getMode(): EDeepModelFilterDistinctMode {
        return this._mode;
    }

    // this     AND     new
    // NIN      AND     NIN     -> NIN(this + new)
    // NIN      AND     IN      -> IN(new - this)       ! inverse negate
    // IN       AND     NIN     -> IN(this - new)
    // IN       AND     IN      -> IN(Schnittmenge(this,new))
    public andDistinct(newMode: EDeepModelFilterDistinctMode, newFilterValues: TVal[]): void {
        const thisNeg = this._mode === EDeepModelFilterDistinctMode.eNIN;
        const newNeg = newMode === EDeepModelFilterDistinctMode.eNIN;
        if (thisNeg && newNeg) {           // NIN && NIN -> NIN
            this._filterValues = FnArraySet.union(this._filterValues, newFilterValues);
        } else if (thisNeg && !newNeg) {   // NIN && IN -> IN
            this._filterValues = FnArraySet.aWithoutB(newFilterValues, this._filterValues);
            this._mode = EDeepModelFilterDistinctMode.eIN;
        } else if (!thisNeg && newNeg) {   // IN && NIN -> IN
            this._filterValues = FnArraySet.aWithoutB(this._filterValues, newFilterValues);
        } else if (!thisNeg && !newNeg) {  // IN && IN -> IN
            this._filterValues = FnArraySet.intersection(this._filterValues, newFilterValues);
        }
    }

    public andRange(constraint: DeepModelFilterFieldConstraintRANGE<TVal>): void {
        // keep only those, who pass range filter
        // in case of  IN: remove range afterwards, all allowed elements are in filterValue
        // in case of NIN: don't remove range, values that do not pass range filter are not needed anymore,
        //                                        since they will still be filtered by range
        this._filterValues = this._filterValues.filter(val => constraint.passes(val));
    }
}