/* v-autosize для textarea: висота під текст. box-sizing: border-box, тож до scrollHeight додаємо рамку —
   інакше поле на 2 px нижче за текст і під час набору смикається. */
const fit = el => { el.style.height = "auto"; el.style.height = Math.max(48, el.scrollHeight + el.offsetHeight - el.clientHeight) + "px"; };
export const autosize = { mounted: fit, updated: fit };
