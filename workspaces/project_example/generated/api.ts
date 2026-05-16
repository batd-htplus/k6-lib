/* eslint-disable */
/**
 * AUTO-GENERATED — DO NOT EDIT.
 * Source: Project Example API v1.0.0
 * Generator: @htplus/k6-lib openapi codegen
 */
import { RestClient, CallOptions, TypedResponse } from '@htplus/k6-lib';

export type PostResponse = {
  data: {
  id: number;
  title: string;
  content: string;
};
};

export type CreatePostInput = {
  title: string;
  content?: string;
};

export type UpdatePostInput = {
  title?: string;
  content?: string;
};

export interface PostsApi {
    createPost: (body: CreatePostInput, opts?: CallOptions) => TypedResponse<PostResponse>;
    getPost: (id: number, opts?: CallOptions) => TypedResponse<PostResponse>;
    updatePost: (id: number, body: UpdatePostInput, opts?: CallOptions) => TypedResponse<PostResponse>;
    deletePost: (id: number, opts?: CallOptions) => TypedResponse<unknown>;
}

export function createPostsApi(client: RestClient): PostsApi {
    return {
        createPost: (body: CreatePostInput, opts?: CallOptions) => {
            return client.post('/posts', body, { ...(opts || {}), params: { ...(opts?.params || {}),  } });
        },

        getPost: (id: number, opts?: CallOptions) => {
            return client.get(`/posts/${id}`, { ...(opts || {}), params: { ...(opts?.params || {}),  } });
        },

        updatePost: (id: number, body: UpdatePostInput, opts?: CallOptions) => {
            return client.put(`/posts/${id}`, body, { ...(opts || {}), params: { ...(opts?.params || {}),  } });
        },

        deletePost: (id: number, opts?: CallOptions) => {
            return client.del(`/posts/${id}`, undefined, { ...(opts || {}), params: { ...(opts?.params || {}),  } });
        },
    };
}


export interface GeneratedApi {
    posts: PostsApi;
}

export function createApi(client: RestClient): GeneratedApi {
    return {
        posts: createPostsApi(client),
    };
}
