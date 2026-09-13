/* v-autosize для textarea: висота під текст. */
const fit = el => { el.style.height = "auto"; el.style.height = Math.max(48, el.scrollHeight) + "px"; };
export const autosize = { mounted: fit, updated: fit };
