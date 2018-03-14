import { DeepSubModelDefinition } from './definitionSub';
import {
    DescField,
    EFieldType
}                                 from './description';
import { DeepModelDescription }   from './modelDescription';

export class DescFieldSubModelArray<TDesc extends DeepModelDescription = DeepModelDescription>
    extends DescField<any[]> {

    private _subDefinition: DeepSubModelDefinition<TDesc>;

    get subDefinition(): DeepSubModelDefinition<TDesc> {
        return this._subDefinition;
    }

    get subDesc(): TDesc {
        return this._desc;
    }

    constructor(label: string,
                private _desc: TDesc) {
        super(label, EFieldType.eSubModel, true);
        this._desc = {
            _id: new DescField('ID', EFieldType.eString)
            ...this._desc as any
        };
        this._subDefinition = new DeepSubModelDefinition(this._desc, label, this);
        this._subDefinition.activate();
    }

    public activate(): void {
        this._subDefinition.activate();
    }

    public convertToDocument(val: any[]) {
        const subDataArr: any[] = [];
        val.forEach((modelData: any) => {
            subDataArr.push(this._subDefinition.arrToDocument(modelData));
        });
        return subDataArr;
    }

    public convertFromDocument(val: any[]) {
        const subDataArr: any[] = [];
        val.forEach((modelData: any) => {
            subDataArr.push(this._subDefinition.documentToArr(modelData));
        });
        return subDataArr;
    }
}