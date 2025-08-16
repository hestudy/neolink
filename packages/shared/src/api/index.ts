import { bookmarksRouter } from './bookmarks';
import { searchRouter } from './search';
import { tagsRouter } from './tags';
import { systemRouter } from './system';

/**
 * 主应用路由器 - 组合所有子路由器
 */
export const appRouter = {
  bookmarks: bookmarksRouter,
  search: searchRouter,
  tags: tagsRouter,
  system: systemRouter,
};

/**
 * 应用路由器类型 - 用于客户端类型推断
 */
export type AppRouter = typeof appRouter;

// 导出所有子路由器
export { bookmarksRouter } from './bookmarks';
export { searchRouter } from './search';
export { tagsRouter } from './tags';
export { systemRouter } from './system';

// 导出路由器类型
export type BookmarksRouter = typeof bookmarksRouter;
export type SearchRouter = typeof searchRouter;
export type TagsRouter = typeof tagsRouter;
export type SystemRouter = typeof systemRouter;
