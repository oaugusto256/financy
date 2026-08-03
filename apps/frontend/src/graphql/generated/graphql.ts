/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import { DocumentTypeDecoration } from '@graphql-typed-document-node/core';
import { useQuery, useMutation, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { fetcher } from '@/lib/graphql-client';
export type SignInInput = {
  email: string;
  password: string;
};

export type SignUpInput = {
  email: string;
  name: string;
  password: string;
};

export type UpdateProfileInput = {
  name: string;
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
