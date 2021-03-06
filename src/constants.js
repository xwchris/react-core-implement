/**
 * 常量文件
 *
 * 用于定义各种常量
 */

// 前缀
const prefix = '@react/__';


// 通用常量
export const TEXT_NODE = `${prefix}text_node`;

export const OPERATION = {
  ADD: `${prefix}operation_add`,
  REMOVE: `${prefix}operation_remove`,
  REPLACE: `${prefix}operation_replace`,
  UPDATE: `${prefix}_operation_update`,
};


// diff中常量
export const RENDERED_INTERNAL_INSTANCE = `${prefix}rendered_internal_instance`;

export const INTERNAL_INSTANCE = `${prefix}internal_instance`;


// fiber中的常量
export const HOST_COMPONENT = `${prefix}host_component`;

export const COMPOSITE_COMPONENT = `${prefix}composite_component`;

export const HOST_ROOT = `${prefix}host_root`;

export const ENOUGH_TIME = 1;

export const ROOT_FIBER = `${prefix}root_fiber`;

export const INSTANCE_INNER_FIBER = `${prefix}instance_inner_fiber`;
