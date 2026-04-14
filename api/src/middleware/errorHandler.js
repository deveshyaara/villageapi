/**
 * Centralised error handler.
 * Always returns { success: false, error: { code, message } }.
 */
export default function errorHandler(err, _req, res, _next) {
  const statusCode = err.statusCode || 500;
  const code = err.code || "INTERNAL_ERROR";
  const message =
    process.env.NODE_ENV === "production" && statusCode === 500
      ? "An unexpected error occurred"
      : err.message || "An unexpected error occurred";

  console.error(`[Error] ${code} (${statusCode}):`, err.message);
  if (process.env.NODE_ENV !== "production") {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    error: { code, message },
  });
}
