/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import { DocumentTypeDecoration } from '@graphql-typed-document-node/core';
import { useQuery, useMutation, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { fetcher } from '@/lib/graphql-client';
export type CategoryColor =
  | 'BLUE'
  | 'GREEN'
  | 'ORANGE'
  | 'PINK'
  | 'PURPLE'
  | 'RED'
  | 'YELLOW';

export type CategoryIcon =
  | 'BIKE'
  | 'BOOK_OPEN'
  | 'BRIEFCASE'
  | 'BUS'
  | 'CREDIT_CARD'
  | 'GIFT'
  | 'HAND_COINS'
  | 'HEART_PULSE'
  | 'HOME'
  | 'PIGGY_BANK'
  | 'RECEIPT'
  | 'SHOPPING_CART'
  | 'STORE'
  | 'TICKET'
  | 'UTENSILS'
  | 'WALLET';

export type CreateCategoryInput = {
  color: CategoryColor;
  description?: string | null | undefined;
  icon: CategoryIcon;
  name: string;
};

export type CreateTransactionInput = {
  amount: number;
  categoryId?: string | number | null | undefined;
  date: string;
  description: string;
  type: TransactionType;
};

export type SignInInput = {
  email: string;
  password: string;
};

export type SignUpInput = {
  email: string;
  name: string;
  password: string;
};

export type TransactionFilter = {
  categoryId?: string | number | null | undefined;
  /** Inclusive lower bound on the transaction's own date. */
  dateFrom?: string | null | undefined;
  /** Inclusive upper bound. */
  dateTo?: string | null | undefined;
  /** Case-insensitive substring of the description. */
  search?: string | null | undefined;
  type?: TransactionType | null | undefined;
};

export type TransactionType =
  | 'EXPENSE'
  | 'INCOME';

export type UpdateCategoryInput = {
  color?: CategoryColor | null | undefined;
  description?: string | null | undefined;
  icon?: CategoryIcon | null | undefined;
  name?: string | null | undefined;
};

export type UpdateProfileInput = {
  name: string;
};

export type UpdateTransactionInput = {
  amount?: number | null | undefined;
  categoryId?: string | number | null | undefined;
  date?: string | null | undefined;
  description?: string | null | undefined;
  type?: TransactionType | null | undefined;
};

export type MeQueryVariables = Exact<{ [key: string]: never; }>;


export type MeQuery = { me: { id: string, name: string, email: string, createdAt: string } };

export type SignInMutationVariables = Exact<{
  input: SignInInput;
}>;


export type SignInMutation = { signIn: { token: string, user: { id: string, name: string, email: string, createdAt: string } } };

export type SignUpMutationVariables = Exact<{
  input: SignUpInput;
}>;


export type SignUpMutation = { signUp: { token: string, user: { id: string, name: string, email: string, createdAt: string } } };

export type UpdateProfileMutationVariables = Exact<{
  input: UpdateProfileInput;
}>;


export type UpdateProfileMutation = { updateProfile: { id: string, name: string, email: string, createdAt: string } };

export type CategoriesQueryVariables = Exact<{ [key: string]: never; }>;


export type CategoriesQuery = { categories: Array<{ id: string, name: string, description: string | null, icon: CategoryIcon, color: CategoryColor, transactionCount: number, totalAmount: number }> };

export type CategoryStatsQueryVariables = Exact<{ [key: string]: never; }>;


export type CategoryStatsQuery = { categoryStats: { totalCategories: number, totalTransactions: number, mostUsed: { id: string, name: string, icon: CategoryIcon, color: CategoryColor } | null } };

export type CreateCategoryMutationVariables = Exact<{
  input: CreateCategoryInput;
}>;


export type CreateCategoryMutation = { createCategory: { id: string } };

export type UpdateCategoryMutationVariables = Exact<{
  id: string | number;
  input: UpdateCategoryInput;
}>;


export type UpdateCategoryMutation = { updateCategory: { id: string } };

export type DeleteCategoryMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteCategoryMutation = { deleteCategory: boolean };

export type SummaryQueryVariables = Exact<{
  month: number;
  year: number;
}>;


export type SummaryQuery = { summary: { totalBalance: number, monthIncome: number, monthExpense: number } };

export type TransactionsQueryVariables = Exact<{
  filter?: TransactionFilter | null | undefined;
  limit?: number | null | undefined;
  offset?: number | null | undefined;
}>;


export type TransactionsQuery = { transactions: { totalCount: number, items: Array<{ id: string, description: string, amount: number, type: TransactionType, date: string, category: { id: string, name: string, icon: CategoryIcon, color: CategoryColor } | null }> } };

export type CreateTransactionMutationVariables = Exact<{
  input: CreateTransactionInput;
}>;


export type CreateTransactionMutation = { createTransaction: { id: string } };

export type UpdateTransactionMutationVariables = Exact<{
  id: string | number;
  input: UpdateTransactionInput;
}>;


export type UpdateTransactionMutation = { updateTransaction: { id: string } };

export type DeleteTransactionMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteTransactionMutation = { deleteTransaction: boolean };


export class TypedDocumentString<TResult, TVariables>
  extends String
  implements DocumentTypeDecoration<TResult, TVariables>
{
  __apiType?: NonNullable<DocumentTypeDecoration<TResult, TVariables>['__apiType']>;
  private value: string;
  public __meta__?: Record<string, any> | undefined;

  constructor(value: string, __meta__?: Record<string, any> | undefined) {
    super(value);
    this.value = value;
    this.__meta__ = __meta__;
  }

  override toString(): string & DocumentTypeDecoration<TResult, TVariables> {
    return this.value;
  }
}

export const MeDocument = new TypedDocumentString(`
    query Me {
  me {
    id
    name
    email
    createdAt
  }
}
    `);

export const useMeQuery = <
      TData = MeQuery,
      TError = unknown
    >(
      variables?: MeQueryVariables,
      options?: Omit<UseQueryOptions<MeQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<MeQuery, TError, TData>['queryKey'] }
    ) => {
    
    return useQuery<MeQuery, TError, TData>(
      {
    queryKey: variables === undefined ? ['Me'] : ['Me', variables],
    queryFn: fetcher<MeQuery, MeQueryVariables>(MeDocument, variables),
    ...options
  }
    )};

useMeQuery.getKey = (variables?: MeQueryVariables) => variables === undefined ? ['Me'] : ['Me', variables];


useMeQuery.fetcher = (variables?: MeQueryVariables, options?: RequestInit['headers']) => fetcher<MeQuery, MeQueryVariables>(MeDocument, variables, options);

export const SignInDocument = new TypedDocumentString(`
    mutation SignIn($input: SignInInput!) {
  signIn(input: $input) {
    token
    user {
      id
      name
      email
      createdAt
    }
  }
}
    `);

export const useSignInMutation = <
      TError = unknown,
      TContext = unknown
    >(options?: UseMutationOptions<SignInMutation, TError, SignInMutationVariables, TContext>) => {
    
    return useMutation<SignInMutation, TError, SignInMutationVariables, TContext>(
      {
    mutationKey: ['SignIn'],
    mutationFn: (variables?: SignInMutationVariables) => fetcher<SignInMutation, SignInMutationVariables>(SignInDocument, variables)(),
    ...options
  }
    )};


useSignInMutation.fetcher = (variables: SignInMutationVariables, options?: RequestInit['headers']) => fetcher<SignInMutation, SignInMutationVariables>(SignInDocument, variables, options);

export const SignUpDocument = new TypedDocumentString(`
    mutation SignUp($input: SignUpInput!) {
  signUp(input: $input) {
    token
    user {
      id
      name
      email
      createdAt
    }
  }
}
    `);

export const useSignUpMutation = <
      TError = unknown,
      TContext = unknown
    >(options?: UseMutationOptions<SignUpMutation, TError, SignUpMutationVariables, TContext>) => {
    
    return useMutation<SignUpMutation, TError, SignUpMutationVariables, TContext>(
      {
    mutationKey: ['SignUp'],
    mutationFn: (variables?: SignUpMutationVariables) => fetcher<SignUpMutation, SignUpMutationVariables>(SignUpDocument, variables)(),
    ...options
  }
    )};


useSignUpMutation.fetcher = (variables: SignUpMutationVariables, options?: RequestInit['headers']) => fetcher<SignUpMutation, SignUpMutationVariables>(SignUpDocument, variables, options);

export const UpdateProfileDocument = new TypedDocumentString(`
    mutation UpdateProfile($input: UpdateProfileInput!) {
  updateProfile(input: $input) {
    id
    name
    email
    createdAt
  }
}
    `);

export const useUpdateProfileMutation = <
      TError = unknown,
      TContext = unknown
    >(options?: UseMutationOptions<UpdateProfileMutation, TError, UpdateProfileMutationVariables, TContext>) => {
    
    return useMutation<UpdateProfileMutation, TError, UpdateProfileMutationVariables, TContext>(
      {
    mutationKey: ['UpdateProfile'],
    mutationFn: (variables?: UpdateProfileMutationVariables) => fetcher<UpdateProfileMutation, UpdateProfileMutationVariables>(UpdateProfileDocument, variables)(),
    ...options
  }
    )};


useUpdateProfileMutation.fetcher = (variables: UpdateProfileMutationVariables, options?: RequestInit['headers']) => fetcher<UpdateProfileMutation, UpdateProfileMutationVariables>(UpdateProfileDocument, variables, options);

export const CategoriesDocument = new TypedDocumentString(`
    query Categories {
  categories {
    id
    name
    description
    icon
    color
    transactionCount
    totalAmount
  }
}
    `);

export const useCategoriesQuery = <
      TData = CategoriesQuery,
      TError = unknown
    >(
      variables?: CategoriesQueryVariables,
      options?: Omit<UseQueryOptions<CategoriesQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<CategoriesQuery, TError, TData>['queryKey'] }
    ) => {
    
    return useQuery<CategoriesQuery, TError, TData>(
      {
    queryKey: variables === undefined ? ['Categories'] : ['Categories', variables],
    queryFn: fetcher<CategoriesQuery, CategoriesQueryVariables>(CategoriesDocument, variables),
    ...options
  }
    )};

useCategoriesQuery.getKey = (variables?: CategoriesQueryVariables) => variables === undefined ? ['Categories'] : ['Categories', variables];


useCategoriesQuery.fetcher = (variables?: CategoriesQueryVariables, options?: RequestInit['headers']) => fetcher<CategoriesQuery, CategoriesQueryVariables>(CategoriesDocument, variables, options);

export const CategoryStatsDocument = new TypedDocumentString(`
    query CategoryStats {
  categoryStats {
    totalCategories
    totalTransactions
    mostUsed {
      id
      name
      icon
      color
    }
  }
}
    `);

export const useCategoryStatsQuery = <
      TData = CategoryStatsQuery,
      TError = unknown
    >(
      variables?: CategoryStatsQueryVariables,
      options?: Omit<UseQueryOptions<CategoryStatsQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<CategoryStatsQuery, TError, TData>['queryKey'] }
    ) => {
    
    return useQuery<CategoryStatsQuery, TError, TData>(
      {
    queryKey: variables === undefined ? ['CategoryStats'] : ['CategoryStats', variables],
    queryFn: fetcher<CategoryStatsQuery, CategoryStatsQueryVariables>(CategoryStatsDocument, variables),
    ...options
  }
    )};

useCategoryStatsQuery.getKey = (variables?: CategoryStatsQueryVariables) => variables === undefined ? ['CategoryStats'] : ['CategoryStats', variables];


useCategoryStatsQuery.fetcher = (variables?: CategoryStatsQueryVariables, options?: RequestInit['headers']) => fetcher<CategoryStatsQuery, CategoryStatsQueryVariables>(CategoryStatsDocument, variables, options);

export const CreateCategoryDocument = new TypedDocumentString(`
    mutation CreateCategory($input: CreateCategoryInput!) {
  createCategory(input: $input) {
    id
  }
}
    `);

export const useCreateCategoryMutation = <
      TError = unknown,
      TContext = unknown
    >(options?: UseMutationOptions<CreateCategoryMutation, TError, CreateCategoryMutationVariables, TContext>) => {
    
    return useMutation<CreateCategoryMutation, TError, CreateCategoryMutationVariables, TContext>(
      {
    mutationKey: ['CreateCategory'],
    mutationFn: (variables?: CreateCategoryMutationVariables) => fetcher<CreateCategoryMutation, CreateCategoryMutationVariables>(CreateCategoryDocument, variables)(),
    ...options
  }
    )};


useCreateCategoryMutation.fetcher = (variables: CreateCategoryMutationVariables, options?: RequestInit['headers']) => fetcher<CreateCategoryMutation, CreateCategoryMutationVariables>(CreateCategoryDocument, variables, options);

export const UpdateCategoryDocument = new TypedDocumentString(`
    mutation UpdateCategory($id: ID!, $input: UpdateCategoryInput!) {
  updateCategory(id: $id, input: $input) {
    id
  }
}
    `);

export const useUpdateCategoryMutation = <
      TError = unknown,
      TContext = unknown
    >(options?: UseMutationOptions<UpdateCategoryMutation, TError, UpdateCategoryMutationVariables, TContext>) => {
    
    return useMutation<UpdateCategoryMutation, TError, UpdateCategoryMutationVariables, TContext>(
      {
    mutationKey: ['UpdateCategory'],
    mutationFn: (variables?: UpdateCategoryMutationVariables) => fetcher<UpdateCategoryMutation, UpdateCategoryMutationVariables>(UpdateCategoryDocument, variables)(),
    ...options
  }
    )};


useUpdateCategoryMutation.fetcher = (variables: UpdateCategoryMutationVariables, options?: RequestInit['headers']) => fetcher<UpdateCategoryMutation, UpdateCategoryMutationVariables>(UpdateCategoryDocument, variables, options);

export const DeleteCategoryDocument = new TypedDocumentString(`
    mutation DeleteCategory($id: ID!) {
  deleteCategory(id: $id)
}
    `);

export const useDeleteCategoryMutation = <
      TError = unknown,
      TContext = unknown
    >(options?: UseMutationOptions<DeleteCategoryMutation, TError, DeleteCategoryMutationVariables, TContext>) => {
    
    return useMutation<DeleteCategoryMutation, TError, DeleteCategoryMutationVariables, TContext>(
      {
    mutationKey: ['DeleteCategory'],
    mutationFn: (variables?: DeleteCategoryMutationVariables) => fetcher<DeleteCategoryMutation, DeleteCategoryMutationVariables>(DeleteCategoryDocument, variables)(),
    ...options
  }
    )};


useDeleteCategoryMutation.fetcher = (variables: DeleteCategoryMutationVariables, options?: RequestInit['headers']) => fetcher<DeleteCategoryMutation, DeleteCategoryMutationVariables>(DeleteCategoryDocument, variables, options);

export const SummaryDocument = new TypedDocumentString(`
    query Summary($month: Int!, $year: Int!) {
  summary(month: $month, year: $year) {
    totalBalance
    monthIncome
    monthExpense
  }
}
    `);

export const useSummaryQuery = <
      TData = SummaryQuery,
      TError = unknown
    >(
      variables: SummaryQueryVariables,
      options?: Omit<UseQueryOptions<SummaryQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<SummaryQuery, TError, TData>['queryKey'] }
    ) => {
    
    return useQuery<SummaryQuery, TError, TData>(
      {
    queryKey: ['Summary', variables],
    queryFn: fetcher<SummaryQuery, SummaryQueryVariables>(SummaryDocument, variables),
    ...options
  }
    )};

useSummaryQuery.getKey = (variables: SummaryQueryVariables) => ['Summary', variables];


useSummaryQuery.fetcher = (variables: SummaryQueryVariables, options?: RequestInit['headers']) => fetcher<SummaryQuery, SummaryQueryVariables>(SummaryDocument, variables, options);

export const TransactionsDocument = new TypedDocumentString(`
    query Transactions($filter: TransactionFilter, $limit: Int, $offset: Int) {
  transactions(filter: $filter, limit: $limit, offset: $offset) {
    totalCount
    items {
      id
      description
      amount
      type
      date
      category {
        id
        name
        icon
        color
      }
    }
  }
}
    `);

export const useTransactionsQuery = <
      TData = TransactionsQuery,
      TError = unknown
    >(
      variables?: TransactionsQueryVariables,
      options?: Omit<UseQueryOptions<TransactionsQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<TransactionsQuery, TError, TData>['queryKey'] }
    ) => {
    
    return useQuery<TransactionsQuery, TError, TData>(
      {
    queryKey: variables === undefined ? ['Transactions'] : ['Transactions', variables],
    queryFn: fetcher<TransactionsQuery, TransactionsQueryVariables>(TransactionsDocument, variables),
    ...options
  }
    )};

useTransactionsQuery.getKey = (variables?: TransactionsQueryVariables) => variables === undefined ? ['Transactions'] : ['Transactions', variables];


useTransactionsQuery.fetcher = (variables?: TransactionsQueryVariables, options?: RequestInit['headers']) => fetcher<TransactionsQuery, TransactionsQueryVariables>(TransactionsDocument, variables, options);

export const CreateTransactionDocument = new TypedDocumentString(`
    mutation CreateTransaction($input: CreateTransactionInput!) {
  createTransaction(input: $input) {
    id
  }
}
    `);

export const useCreateTransactionMutation = <
      TError = unknown,
      TContext = unknown
    >(options?: UseMutationOptions<CreateTransactionMutation, TError, CreateTransactionMutationVariables, TContext>) => {
    
    return useMutation<CreateTransactionMutation, TError, CreateTransactionMutationVariables, TContext>(
      {
    mutationKey: ['CreateTransaction'],
    mutationFn: (variables?: CreateTransactionMutationVariables) => fetcher<CreateTransactionMutation, CreateTransactionMutationVariables>(CreateTransactionDocument, variables)(),
    ...options
  }
    )};


useCreateTransactionMutation.fetcher = (variables: CreateTransactionMutationVariables, options?: RequestInit['headers']) => fetcher<CreateTransactionMutation, CreateTransactionMutationVariables>(CreateTransactionDocument, variables, options);

export const UpdateTransactionDocument = new TypedDocumentString(`
    mutation UpdateTransaction($id: ID!, $input: UpdateTransactionInput!) {
  updateTransaction(id: $id, input: $input) {
    id
  }
}
    `);

export const useUpdateTransactionMutation = <
      TError = unknown,
      TContext = unknown
    >(options?: UseMutationOptions<UpdateTransactionMutation, TError, UpdateTransactionMutationVariables, TContext>) => {
    
    return useMutation<UpdateTransactionMutation, TError, UpdateTransactionMutationVariables, TContext>(
      {
    mutationKey: ['UpdateTransaction'],
    mutationFn: (variables?: UpdateTransactionMutationVariables) => fetcher<UpdateTransactionMutation, UpdateTransactionMutationVariables>(UpdateTransactionDocument, variables)(),
    ...options
  }
    )};


useUpdateTransactionMutation.fetcher = (variables: UpdateTransactionMutationVariables, options?: RequestInit['headers']) => fetcher<UpdateTransactionMutation, UpdateTransactionMutationVariables>(UpdateTransactionDocument, variables, options);

export const DeleteTransactionDocument = new TypedDocumentString(`
    mutation DeleteTransaction($id: ID!) {
  deleteTransaction(id: $id)
}
    `);

export const useDeleteTransactionMutation = <
      TError = unknown,
      TContext = unknown
    >(options?: UseMutationOptions<DeleteTransactionMutation, TError, DeleteTransactionMutationVariables, TContext>) => {
    
    return useMutation<DeleteTransactionMutation, TError, DeleteTransactionMutationVariables, TContext>(
      {
    mutationKey: ['DeleteTransaction'],
    mutationFn: (variables?: DeleteTransactionMutationVariables) => fetcher<DeleteTransactionMutation, DeleteTransactionMutationVariables>(DeleteTransactionDocument, variables)(),
    ...options
  }
    )};


useDeleteTransactionMutation.fetcher = (variables: DeleteTransactionMutationVariables, options?: RequestInit['headers']) => fetcher<DeleteTransactionMutation, DeleteTransactionMutationVariables>(DeleteTransactionDocument, variables, options);
