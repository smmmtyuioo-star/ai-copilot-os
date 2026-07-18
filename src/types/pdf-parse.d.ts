declare module 'pdf-parse' {
  interface PdfInfo {
    Title?: string
    Author?: string
    Subject?: string
    Keywords?: string
    Creator?: string
    Producer?: string
    CreationDate?: string
    ModDate?: string
  }
  interface PdfResult {
    numpages: number
    numrender: number
    info: PdfInfo
    metadata: any
    text: string
    version: string
  }
  function pdfParse(data: Buffer | Uint8Array, options?: Record<string, any>): Promise<PdfResult>
  export default pdfParse
}
