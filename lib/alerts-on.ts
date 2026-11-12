import { hasDb } from './db';
import { isMailConfigured } from './mailer';

/** Email signup shows only when there is a database to store it and a way to send mail. */
export const alertsOn = () => hasDb() && isMailConfigured();
