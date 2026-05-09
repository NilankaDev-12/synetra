import { ApolloClient, ApolloLink, InMemoryCache, createHttpLink } from '@apollo/client';
import { GRAPHQL_URL } from '../utils/constants';
import { getToken } from '../utils/helpers';

const httpLink = createHttpLink({
  uri: GRAPHQL_URL,
});

// Use a plain ApolloLink instead of setContext from @apollo/client/link/context.
//
// WHY: setContext internally calls `.then(operation.setContext)` without binding
// `operation` as `this`, so in Apollo Client 3.8.x the Promise chain loses the
// reference to `forward` and throws "next is not a function" on every mutation.
//
// A plain ApolloLink with a synchronous header injection has no such issue —
// it calls `forward(operation)` directly and the binding is never lost.
const authLink = new ApolloLink((operation, forward) => {
  const token = getToken();

  operation.setContext(({ headers = {} }) => ({
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  }));

  return forward(operation);
});

const client = new ApolloClient({
  link: ApolloLink.from([authLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'network-only',
    },
    query: {
      fetchPolicy: 'network-only',
    },
  },
});

export default client;