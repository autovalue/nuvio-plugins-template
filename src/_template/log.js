import { PROVIDER_NAME} from './extractor';

export default function log() {
  let logMethod = 'log';
  const args = Array.from(arguments);
  if (['error', 'warn', 'info', 'debug'].includes(args[0])) {
    logMethod = args[0];
    args.shift();
  }
  console[logMethod](`[${PROVIDER_NAME}]`, args)
}
