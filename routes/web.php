<?php

use App\Http\Controllers\ReportDownloadController;
use App\Http\Controllers\SpaController;
use Illuminate\Support\Facades\Route;

Route::get('/reportes/{interviewSession}/pdf', ReportDownloadController::class);
Route::get('/{any?}', SpaController::class)->where('any', '^(?!api|storage|up).*$');
