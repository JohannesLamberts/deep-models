import { DescField } from './description';

export interface DeepModelDescription {
    [key: string]: DescField<any>;
}