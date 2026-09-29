/// <reference types="vite/client" />

declare module 'bwip-js' {
  interface ToCanvasOptions {
    bcid: string
    text: string
    scale?: number
    height?: number
    width?: number
    includetext?: boolean
    textxalign?: string
    textsize?: number
    [key: string]: any
  }

  export function toCanvas(canvas: HTMLCanvasElement | string, options: ToCanvasOptions): HTMLCanvasElement
  export function toSVG(options: ToCanvasOptions): string
  export default {
    toCanvas,
    toSVG,
  }
}
