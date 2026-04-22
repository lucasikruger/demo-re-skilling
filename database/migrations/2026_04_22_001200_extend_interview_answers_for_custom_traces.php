<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('interview_answers', function (Blueprint $table) {
            $table->dropUnique(['interview_session_id', 'question_id']);
            $table->foreignId('question_id')->nullable()->change();
            $table->string('public_id')->nullable()->unique()->after('id');
            $table->string('prompt_snapshot')->nullable()->after('question_id');
            $table->unsignedInteger('time_limit_seconds')->nullable()->after('sort_order');
            $table->json('question_materials')->nullable()->after('prosody_payload');
            $table->json('model_trace')->nullable()->after('question_materials');
        });

        DB::table('interview_answers')->update([
            'public_id' => DB::raw("md5(random()::text || clock_timestamp()::text)"),
        ]);

        Schema::table('interview_answers', function (Blueprint $table) {
            $table->string('public_id')->nullable(false)->change();
            $table->unique(['interview_session_id', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::table('interview_answers', function (Blueprint $table) {
            $table->dropUnique(['interview_session_id', 'sort_order']);
            $table->dropColumn(['public_id', 'prompt_snapshot', 'time_limit_seconds', 'question_materials', 'model_trace']);
            $table->foreignId('question_id')->nullable(false)->change();
            $table->unique(['interview_session_id', 'question_id']);
        });
    }
};
