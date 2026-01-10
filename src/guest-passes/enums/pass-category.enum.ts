export enum PassCategory {
  DELEGATE = 'DELEGATE',
  VVIP = 'VVIP',
  VISITOR = 'VISITOR',
}

export const CATEGORY_LIMITS = {
  [PassCategory.DELEGATE]: 500,
  [PassCategory.VVIP]: 100,
  [PassCategory.VISITOR]: 1000,
};

export const CATEGORY_PREFIXES = {
  [PassCategory.DELEGATE]: 'DELEGATE',
  [PassCategory.VVIP]: 'VVIP',
  [PassCategory.VISITOR]: 'VISITOR',
};