export const summaryTypeDefs = /* GraphQL */ `
  type Summary {
    "All-time income minus expense, in cents. Can be negative."
    totalBalance: Int!
    "Income within the requested month, in cents."
    monthIncome: Int!
    "Expense within the requested month, in cents, unsigned."
    monthExpense: Int!
  }

  extend type Query {
    "The month window is built in UTC. backend.md section 5."
    summary(month: Int!, year: Int!): Summary!
  }
`;
