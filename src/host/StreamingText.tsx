interface Props {
  text: string;
  streaming: boolean;
  placeholder?: string;
}

export default function StreamingText({ text, streaming, placeholder }: Props) {
  if (!text && !streaming) {
    return <p className="stream-empty">{placeholder ?? "—"}</p>;
  }
  return (
    <p className="stream">
      {text || (streaming ? "" : placeholder ?? "")}
      {streaming && <span className="stream-cursor" />}
    </p>
  );
}
