export default function handler(req: any, res: any) {
  res.json({ pong: true, time: new Date().toISOString() });
}
