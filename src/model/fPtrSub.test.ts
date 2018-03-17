import { expect }                 from 'chai';
import 'mocha';
import {
    DeepModelDefinition,
    kDeepModelPayloadRootSegment
}                                 from './definition/definition';
import {
    DescField,
    EFieldType
}                                 from './definition/description';
import { DescFieldSubModelArray } from './definition/fieldSubModelArray';
import { DeepModelDescription }   from './definition/modelDescription';
import { DeepModelFPtr }          from './fPtr';
import { DeepModelFPtrSub }       from './fPtrSub';
import { DeepModel }              from './model';

const subModelDesc = {
    number: new DescField('FILD_NAME_INT', EFieldType.eInteger)
};

const modelDef = new DeepModelDefinition(
    'MODULE',
    'IDENT',
    'TEST_OBJECT',
    {
        sub_model: new DescFieldSubModelArray('TEST_SUB_OBJECT', subModelDesc)
    });

const desc = modelDef.rootDescription;

const DeepModelInitial = DeepModel.fromDataArray(
    modelDef.documentToArr({ [kDeepModelPayloadRootSegment]: { sub_model: [] } }),
    modelDef);

describe('DeepModelFPtrSub', function () {
    const model = DeepModelInitial.getClone();
    const fPtr = new DeepModelFPtrSub(model, desc.sub_model);
    it('should return the original array on get()', function () {
        expect(fPtr.get()).to.deep.equal([]);
    });
    let idFirstElement  = '',
        idSecondElement = '';
    it('should create new elements on pushChild()', function () {
        fPtr.pushChild();
        fPtr.pushChild((subModel, subDesc) => {
            subModel.fPtr(subDesc.number).set(123);
        });
        const valAfter = fPtr.get();

        idFirstElement = valAfter[0][0];
        idSecondElement = valAfter[1][0];

        expect(valAfter[0].length).to.equal(2);
        expect(idFirstElement).to.be.a('string');
        expect(idFirstElement.length).to.equal(16);
        expect(valAfter[0][1]).to.equal(0);

        expect(valAfter[1].length).to.equal(2);
        expect(idSecondElement).to.be.a('string');
        expect(idSecondElement.length).to.equal(16);
        expect(valAfter[1][1]).to.equal(123);

        expect(valAfter.length).to.equal(2);
    });
    it('should wrapped elements on getWrapped()', function () {
        const wrapped = fPtr.getChildModels();
        expect(wrapped.length).to.equal(2);
        for (let i = 0; i < 1; i++) {
            expect(wrapped[i]).to.be.instanceof(DeepModel);
            expect(wrapped[i].modelDefinition.rootDescription).to.deep.include(subModelDesc);
        }
        expect(new DeepModelFPtr(wrapped[0],
                                 (wrapped[0].modelDefinition.rootDescription as DeepModelDescription)._id)
                   .get())
            .to.equal(idFirstElement);
        expect(new DeepModelFPtr(wrapped[1],
                                 (wrapped[1].modelDefinition.rootDescription as DeepModelDescription)._id)
                   .get())
            .to.equal(idSecondElement);
    });
    it('should remove an element on pullChild()', function () {
        expect(fPtr.get().length).to.equal(2);
        fPtr.pullChild(0);
        const valAfter = fPtr.get();
        expect(valAfter.length).to.equal(1);
        expect(valAfter[0][0]).to.equal(idSecondElement);
    });
});