/* Тести — чиста логіка без DOM, тому окрема мінімальна конфігурація (без PWA-плагіна). */
export default {
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"]
  }
};
