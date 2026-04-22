<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('context_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('interview_session_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('scope');
            $table->string('kind');
            $table->string('title');
            $table->longText('body_text')->nullable();
            $table->string('file_path')->nullable();
            $table->string('original_filename')->nullable();
            $table->string('mime_type')->nullable();
            $table->string('ingestion_status')->default('pending');
            $table->timestamp('indexed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('context_items');
    }
};
