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

  input TransactionFilter {
    "Case-insensitive substring of the description."
    search: String
    type: TransactionType
    categoryId: ID
    "Inclusive lower bound on the transaction's own date."
    dateFrom: DateTime
    "Inclusive upper bound."
    dateTo: DateTime
  }

  extend type Query {
    transactions(
      filter: TransactionFilter
      limit: Int = 10
      offset: Int = 0
    ): TransactionPage!
  }

  extend type Mutation {
    createTransaction(input: CreateTransactionInput!): Transaction!
    updateTransaction(id: ID!, input: UpdateTransactionInput!): Transaction!
    deleteTransaction(id: ID!): Boolean!
  }
`;
