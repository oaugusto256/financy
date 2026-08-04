export const transactionTypeDefs = /* GraphQL */ `
  enum TransactionType {
    INCOME
    EXPENSE
  }

  type Transaction {
    id: ID!
    description: String!
    amount: Int!
    type: TransactionType!
    date: DateTime!
    category: Category
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type TransactionPage {
    items: [Transaction!]!
    totalCount: Int!
  }

  input CreateTransactionInput {
    description: String!
    amount: Int!
    type: TransactionType!
    date: DateTime!
    categoryId: ID
  }

  input UpdateTransactionInput {
    description: String
    amount: Int
    type: TransactionType
    date: DateTime
    categoryId: ID
  }

  extend type Query {
    # No filter argument: TransactionFilter and the filter bar are slice 4.
    # Declaring it here with nothing calling it would put an untested parameter
    # in the public schema.
    transactions(limit: Int = 10, offset: Int = 0): TransactionPage!
  }

  extend type Mutation {
    createTransaction(input: CreateTransactionInput!): Transaction!
    updateTransaction(id: ID!, input: UpdateTransactionInput!): Transaction!
    deleteTransaction(id: ID!): Boolean!
  }
`;
