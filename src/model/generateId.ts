export const generateID = (): string => {
    let str = '';
    for (let i = 0; i < 16; i++) {
        str += Math.floor(Math.random() * 16).toString(16);
    }
    return str;
};