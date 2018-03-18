import { DescField } from './description';

export interface ModelDescription {
    [key: string]: DescField<any>;
}