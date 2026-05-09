
const typeDefs = `
  type User {
    id: ID!
    name: String!
    email: String!
    avatar: String
  }

  type Comment {
    id: ID!
    document: ID!
    author: User!
    content: String!
    parentComment: Comment
    replies: [Comment!]!
    createdAt: String!
    updatedAt: String!
  }

  type Query {
    getComments(documentId: ID!): [Comment!]!
    getComment(commentId: ID!): Comment
  }

  type Mutation {
    createComment(documentId: ID!, content: String!, parentCommentId: ID): Comment!
    updateComment(commentId: ID!, content: String!): Comment!
    deleteComment(commentId: ID!): String!
  }
`;

module.exports = typeDefs;