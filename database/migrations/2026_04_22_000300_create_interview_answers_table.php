<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('interview_answers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('interview_session_id')->constrained()->cascadeOnDelete();
            $table->foreignId('question_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('sort_order');
            $table->string('status')->default('pending');
            $table->string('audio_path')->nullable();
            $table->string('mime_type')->nullable();
            $table->unsignedInteger('duration_seconds')->nullable();
            $table->longText('transcript')->nullable();
            $table->text('prosody_summary')->nullable();
            $table->json('prosody_payload')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();

            $table->unique(['interview_session_id', 'question_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('interview_answers');
    }
};
