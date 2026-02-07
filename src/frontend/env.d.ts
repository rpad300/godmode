/// <reference types="vite/client" />

// Declare external libraries loaded via CDN
declare const Chart: typeof import('chart.js').Chart;
declare const marked: typeof import('marked');
declare const html2pdf: () => {
  set: (options: object) => html2pdf;
  from: (element: HTMLElement) => html2pdf;
  save: () => Promise<void>;
};

declare namespace vis {
  class Network {
    constructor(container: HTMLElement, data: object, options: object);
    destroy(): void;
    on(event: string, callback: (params: object) => void): void;
    fit(): void;
    selectNodes(nodeIds: string[]): void;
  }
  class DataSet<T = unknown> {
    constructor(data?: T[]);
    add(data: T | T[]): void;
    get(id?: string | string[]): T | T[];
    update(data: T | T[]): void;
    remove(id: string | string[]): void;
    clear(): void;
  }
}

// Extend Window for global variables
interface Window {
  previousStats?: object;
  weeklyReportMarkdown?: string;
}
