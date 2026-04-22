<?php

use App\Http\Controllers\Api\ContextItemController;
use App\Http\Controllers\Api\CustomDemoTemplateController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\InterviewAnswerController;
use App\Http\Controllers\Api\ReportDeliveryController;
use App\Http\Controllers\Api\InterviewSessionController;
use App\Http\Controllers\Api\QuestionController;
use App\Http\Controllers\Api\ReportAccessController;
use App\Http\Controllers\Api\ReportController;
use Illuminate\Support\Facades\Route;

Route::get('/dashboard', DashboardController::class);

Route::post('/questions', [QuestionController::class, 'store']);
Route::put('/questions/{question}', [QuestionController::class, 'update']);
Route::delete('/questions/{question}', [QuestionController::class, 'destroy']);
Route::get('/custom-demos', [CustomDemoTemplateController::class, 'index']);
Route::post('/custom-demos', [CustomDemoTemplateController::class, 'store']);
Route::post('/custom-demos/by-code', [CustomDemoTemplateController::class, 'findByCode']);
Route::get('/custom-demos/{customDemoTemplate}', [CustomDemoTemplateController::class, 'show']);
Route::post('/custom-demos/{customDemoTemplate}/update', [CustomDemoTemplateController::class, 'update']);
Route::delete('/custom-demos/{customDemoTemplate}', [CustomDemoTemplateController::class, 'destroy']);
Route::post('/custom-demos/{customDemoTemplate}/sessions', [CustomDemoTemplateController::class, 'createSession']);

Route::post('/context/global/text', [ContextItemController::class, 'storeGlobalText']);
Route::post('/context/global/document', [ContextItemController::class, 'storeGlobalDocument']);
Route::delete('/context/{contextItem}', [ContextItemController::class, 'destroy']);

Route::post('/sessions', [InterviewSessionController::class, 'store']);
Route::get('/sessions/{interviewSession}', [InterviewSessionController::class, 'show']);
Route::post('/sessions/{interviewSession}/finalize', [InterviewSessionController::class, 'finalize']);
Route::post('/sessions/{interviewSession}/interrupt', [InterviewSessionController::class, 'interrupt']);
Route::post('/sessions/{interviewSession}/sync-questions', [InterviewSessionController::class, 'syncQuestions']);
Route::get('/sessions/{interviewSession}/report', [ReportController::class, 'show']);
Route::post('/sessions/{interviewSession}/context/text', [ContextItemController::class, 'storeSessionText']);
Route::post('/sessions/{interviewSession}/context/document', [ContextItemController::class, 'storeSessionDocument']);
Route::post('/sessions/{interviewSession}/answers/{question}/audio', [InterviewAnswerController::class, 'store']);
Route::post('/sessions/{interviewSession}/answers/by-answer/{interviewAnswer}/audio', [InterviewAnswerController::class, 'storeByAnswer']);
Route::post('/reports/access', ReportAccessController::class);
Route::post('/sessions/{interviewSession}/report/email', ReportDeliveryController::class);
