<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('context_chunks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('context_item_id')->constrained()->cascadeOnDelete();
            $table->foreignId('interview_session_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('scope');
            $table->unsignedInteger('chunk_index');
            $table->text('content');
            $table->json('embedding')->nullable();
            $table->unsignedInteger('token_count')->default(0);
            $table->json('metadata')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('context_chunks');
    }
};
