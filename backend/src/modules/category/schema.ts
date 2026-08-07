export const categoryTypeDefs = /* GraphQL */ `
  enum CategoryColor {
    GREEN
    BLUE
    PURPLE
    PINK
    RED
    ORANGE
    YELLOW
  }

  enum CategoryIcon {
    BRIEFCASE
    BUS
    HEART_PULSE
    PIGGY_BANK
    SHOPPING_CART
    TICKET
    GIFT
    UTENSILS
    BIKE
    HOME
    HAND_COINS
    BOOK_OPEN
    STORE
    WALLET
    CREDIT_CARD
    RECEIPT
  }

  type Category {
    id: ID!
    name: String!
    description: String
    icon: CategoryIcon!
    color: CategoryColor!
    transactionCount: Int!
    totalAmount: Int!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type CategoryStats {
    totalCategories: Int!
    totalTransactions: Int!
    mostUsed: Category
  }

  input CreateCategoryInput {
    name: String!
    description: String
    icon: CategoryIcon!
    color: CategoryColor!
  }

  input UpdateCategoryInput {
    name: String
    description: String
    icon: CategoryIcon
    color: CategoryColor
  }

  extend type Query {
    categories: [Category!]!
    categoryStats: CategoryStats!
  }

  extend type Mutation {
    createCategory(input: CreateCategoryInput!): Category!
    updateCategory(id: ID!, input: UpdateCategoryInput!): Category!
    deleteCategory(id: ID!): Boolean!
  }
`;
