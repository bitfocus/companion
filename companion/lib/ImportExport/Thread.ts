/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: Julian Waller <git@julusian.co.uk>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 */

import workerPool from 'workerpool'
import { ImportExportThreadMethods } from './ThreadMethods.js'

workerPool.worker(ImportExportThreadMethods)
