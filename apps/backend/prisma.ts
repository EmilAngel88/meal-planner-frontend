import { serverConfig } from './utils/config';
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ datasourceUrl: serverConfig.databaseUrl });

export default prisma;
