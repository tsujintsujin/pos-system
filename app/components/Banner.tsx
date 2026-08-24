export default function Banner({ error, success }: { error?: string; success?: string }) {
  if (!error && !success) return null;

  if (error) {
    return (
      <p className="rounded bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
        {error}
      </p>
    );
  }

  return (
    <p className="rounded bg-green-50 px-4 py-3 text-sm text-green-700" role="status">
      {success}
    </p>
  );
}
